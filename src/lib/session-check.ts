import type { AuthSessionResponse } from "@/types/github";
import type { ApiOptions } from "./api";
import { describeError, type ErrorCode } from "./errors";

/**
 * Restoring a saved session, separated from React so it can be tested.
 *
 * - `authed`: the server accepted the bearer session.
 * - `signed-out`: the server answered and the session is gone → the caller may delete the token.
 * - `unreachable`: no definitive answer (offline, timeout, backend down) → keep the token for a retry.
 *
 * The website's `/api/auth/session` answers `{ authenticated: false, canonicalOrigin }` on production
 * hosts other than APP_URL (it moves browsers to the host OAuth is bound to). That reply says nothing
 * about the bearer session, so the check is repeated once on the canonical host instead of signing out.
 */
export type SessionCheck =
  | { kind: "authed"; session: Extract<AuthSessionResponse, { authenticated: true }> }
  | { kind: "signed-out" }
  | { kind: "unreachable"; code: ErrorCode };

type ApiFn = <T>(path: string, options?: ApiOptions) => Promise<T>;

/** Only an https origin on the same parent domain as the configured API is followed. */
export function canonicalApiBase(origin: unknown, apiBase: string): string | null {
  if (typeof origin !== "string") return null;
  try {
    const target = new URL(origin);
    const current = new URL(apiBase);
    if (target.protocol !== "https:" || target.pathname !== "/" || target.search || target.hash) return null;
    const parent = (h: string) => h.split(".").slice(-2).join(".");
    if (parent(target.hostname) !== parent(current.hostname)) return null;
    if (target.origin === current.origin) return null;
    return `${target.origin}/api`;
  } catch {
    return null;
  }
}

export async function checkSession(api: ApiFn, apiBase: string): Promise<SessionCheck> {
  try {
    let res = await api<AuthSessionResponse>("/auth/session", { timeoutMs: 10_000 });
    if (!res.authenticated && res.canonicalOrigin !== undefined) {
      const base = canonicalApiBase(res.canonicalOrigin, apiBase);
      if (!base) return { kind: "unreachable", code: "BACKEND_UNAVAILABLE" };
      res = await api<AuthSessionResponse>("/auth/session", { timeoutMs: 10_000, baseUrl: base });
      // A second redirect would loop; it isn't a statement about the session either.
      if (!res.authenticated && res.canonicalOrigin !== undefined) return { kind: "unreachable", code: "BACKEND_UNAVAILABLE" };
    }
    return res.authenticated ? { kind: "authed", session: res } : { kind: "signed-out" };
  } catch (err) {
    const { code } = describeError(err);
    if (code === "SESSION_EXPIRED" || code === "UNAUTHENTICATED") return { kind: "signed-out" };
    return { kind: "unreachable", code };
  }
}
