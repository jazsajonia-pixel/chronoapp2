import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import type { Session } from "@/types/session";
import type { AuthSessionResponse } from "@/types/github";
import { api, SESSION_EXPIRED_EVENT } from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { checkSession } from "@/lib/session-check";
import { AppError, type ErrorCode, isErrorCode } from "@/lib/errors";
import { on } from "@/lib/events";
import { getSessionToken, loadSessionToken, setSessionToken } from "@/lib/token";

/**
 * Client session state (native). Same server session as the website: GET /api/auth/session, with
 * the sealed session sent as a bearer token from the OS keychain. The GitHub token never reaches
 * the app — it's sealed (AES-GCM) inside that value and only the Chrono API can open it.
 */
interface SessionContextValue {
  session: Session;
  loading: boolean;
  isAuthed: boolean;
  endedReason: ErrorCode | null;
  /** A saved session exists but the server couldn't be reached to confirm it. */
  restoreError: ErrorCode | null;
  signIn: (includePrivate: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/** Restore the saved session. Only a definitive "signed out" from the server deletes the token. */
async function fetchGitHubSession(): Promise<{ session: Session; unreachable: ErrorCode | null }> {
  if (!getSessionToken()) return { session: { mode: "anonymous" }, unreachable: null };
  const result = await checkSession(api, API_BASE);
  if (result.kind === "authed") {
    const res = result.session;
    return { session: { mode: "github", user: res.user, scopes: res.scopes, includePrivate: res.includePrivate, expiresAt: res.expiresAt }, unreachable: null };
  }
  if (result.kind === "signed-out") {
    await setSessionToken(null);
    return { session: { mode: "anonymous" }, unreachable: null };
  }
  // Offline / backend down: signed out for now, token kept so "Try again" can restore it.
  return { session: { mode: "anonymous" }, unreachable: result.code };
}

const b64url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function randomVerifier(): string {
  const bytes = Crypto.getRandomBytes(48);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return b64url(btoa(bin));
}

interface ExchangeResponse extends Extract<AuthSessionResponse, { authenticated: true }> {
  token: string;
}

/**
 * GitHub OAuth for the native app (PKCE-protected handoff, see netlify/lib/mobile-auth.ts in the
 * website repo): system auth browser → GitHub → Chrono callback → chronoapp2://auth?handoff=…
 */
async function nativeGitHubSignIn(includePrivate: boolean): Promise<string> {
  const verifier = randomVerifier();
  const challenge = b64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const redirectUri = Linking.createURL("auth");
  const { authorizeUrl } = await api<{ authorizeUrl: string }>("/auth/github/start", {
    method: "POST",
    body: { includePrivate, mobile: { redirectUri, codeChallenge: challenge } },
  });
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri, { preferEphemeralSession: false });
  if (result.type !== "success") throw new AppError("OAUTH_DENIED", "Sign-in was cancelled.");
  const q = result.url.includes("?") ? result.url.slice(result.url.indexOf("?") + 1).split("#")[0]! : "";
  const params = new URLSearchParams(q);
  const err = params.get("error");
  if (err) throw new AppError(isErrorCode(err) ? err : "OAUTH_EXCHANGE_FAILED");
  const handoff = params.get("handoff");
  if (!handoff) throw new AppError("OAUTH_EXCHANGE_FAILED");
  const res = await api<ExchangeResponse>("/auth/mobile/exchange", { method: "POST", body: { handoff, verifier } });
  return res.token;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ mode: "anonymous" });
  const [loading, setLoading] = useState(true);
  const [endedReason, setEndedReason] = useState<ErrorCode | null>(null);
  const [restoreError, setRestoreError] = useState<ErrorCode | null>(null);

  const apply = useCallback((r: { session: Session; unreachable: ErrorCode | null }) => {
    setSession(r.session);
    setRestoreError(r.unreachable);
  }, []);

  const refresh = useCallback(async () => {
    apply(await fetchGitHubSession());
  }, [apply]);

  useEffect(() => {
    let alive = true;
    void loadSessionToken()
      .then(fetchGitHubSession)
      .then((r) => {
        if (!alive) return;
        apply(r);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apply]);

  useEffect(
    () =>
      on(SESSION_EXPIRED_EVENT, (detail) => {
        const code = detail as ErrorCode;
        void setSessionToken(null);
        setRestoreError(null);
        setSession((cur) => (cur.mode === "github" ? { mode: "anonymous" } : cur));
        setEndedReason(code === "UNAUTHENTICATED" ? "SESSION_EXPIRED" : code);
      }),
    [],
  );

  const signIn = useCallback(async (includePrivate: boolean) => {
    const token = await nativeGitHubSignIn(includePrivate);
    await setSessionToken(token);
    setEndedReason(null);
    const r = await fetchGitHubSession();
    if (r.session.mode !== "github") {
      // Keep the new token when the check only failed to reach the server.
      if (r.unreachable) throw new AppError(r.unreachable);
      throw new AppError("OAUTH_EXCHANGE_FAILED");
    }
    apply(r);
  }, [apply]);

  const signOut = useCallback(async () => {
    if (getSessionToken()) {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        /* drop local state anyway; the session expires on its own */
      }
    }
    await setSessionToken(null);
    setEndedReason(null);
    setRestoreError(null);
    setSession({ mode: "anonymous" });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, isAuthed: session.mode === "github", endedReason, restoreError, signIn, signOut, refresh }),
    [session, loading, endedReason, restoreError, signIn, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
