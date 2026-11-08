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
import { safeStorage } from "@/lib/storage";

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
  /** Signed in from the cached profile while the server check keeps retrying in the background. */
  reconnecting: boolean;
  signIn: (includePrivate: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Last confirmed profile (login, name, avatar, scopes, expiry — never the token). With a saved
 * token it lets the app open straight to Home while the server check runs in the background.
 */
const PROFILE_KEY = "session-profile";
type GitHubSession = Extract<Session, { mode: "github" }>;

function readProfile(): GitHubSession | null {
  if (!getSessionToken()) return null;
  try {
    const p = JSON.parse(safeStorage.get(PROFILE_KEY) ?? "null") as GitHubSession | null;
    if (!p || p.mode !== "github" || !p.user?.login || !(Date.parse(p.expiresAt) > Date.now())) return null;
    return p;
  } catch {
    return null;
  }
}

function saveProfile(s: Session) {
  if (s.mode === "github") safeStorage.set(PROFILE_KEY, JSON.stringify(s));
  else safeStorage.remove(PROFILE_KEY);
}

/** Background re-check delays while the server is unreachable (then every minute). */
const RETRY_MS = [4_000, 10_000, 30_000, 60_000];

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
  // The root layout reads the keychain and local storage before this mounts. A signed-out start never
  // waits on the network, and neither does a saved session with a cached profile: only a saved token
  // without a profile (first run after an update) waits on the launch screen for the server check.
  const [cached] = useState(readProfile);
  const [session, setSession] = useState<Session>(cached ?? { mode: "anonymous" });
  const [loading, setLoading] = useState(() => getSessionToken() !== null && !cached);
  const [endedReason, setEndedReason] = useState<ErrorCode | null>(null);
  const [restoreError, setRestoreError] = useState<ErrorCode | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const apply = useCallback((r: { session: Session; unreachable: ErrorCode | null }) => {
    if (r.unreachable && getSessionToken()) {
      // Server unreachable: keep a cached sign-in and retry quietly instead of signing out.
      const profile = readProfile();
      if (profile) {
        setSession(profile);
        setRestoreError(null);
        setReconnecting(true);
        return;
      }
    }
    setSession((cur) => {
      // A saved sign-in the server now rejects gets a reason on the sign-in screen.
      if (cur.mode === "github" && r.session.mode !== "github" && !r.unreachable) setEndedReason("SESSION_EXPIRED");
      return r.session;
    });
    saveProfile(r.unreachable ? { mode: "anonymous" } : r.session);
    setRestoreError(r.unreachable);
    setReconnecting(false);
  }, []);

  const refresh = useCallback(async () => {
    apply(await fetchGitHubSession());
  }, [apply]);

  useEffect(() => {
    let alive = true;
    // loadSessionToken() is a no-op re-read when the root layout already loaded it (fast, local).
    void loadSessionToken()
      .then(fetchGitHubSession)
      .catch((): { session: Session; unreachable: ErrorCode | null } => ({ session: { mode: "anonymous" }, unreachable: "BACKEND_UNAVAILABLE" }))
      .then((r) => {
        if (!alive) return;
        apply(r);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apply]);

  useEffect(() => {
    if (!reconnecting) return;
    const t = setTimeout(() => {
      void fetchGitHubSession()
        .catch((): { session: Session; unreachable: ErrorCode | null } => ({ session: { mode: "anonymous" }, unreachable: "BACKEND_UNAVAILABLE" }))
        .then((r) => {
          apply(r);
          setAttempt((n) => (r.unreachable ? n + 1 : 0));
        });
    }, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)]);
    return () => clearTimeout(t);
  }, [reconnecting, attempt, apply]);

  useEffect(
    () =>
      on(SESSION_EXPIRED_EVENT, (detail) => {
        const code = detail as ErrorCode;
        void setSessionToken(null);
        saveProfile({ mode: "anonymous" });
        setRestoreError(null);
        setReconnecting(false);
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
    saveProfile({ mode: "anonymous" });
    setEndedReason(null);
    setRestoreError(null);
    setReconnecting(false);
    setSession({ mode: "anonymous" });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, isAuthed: session.mode === "github", endedReason, restoreError, reconnecting, signIn, signOut, refresh }),
    [session, loading, endedReason, restoreError, reconnecting, signIn, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
