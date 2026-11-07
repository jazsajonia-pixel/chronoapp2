import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import type { ApiOptions } from "./api";
import { canonicalApiBase, checkSession } from "./session-check";

const API = "https://chrono-tau.vercel.app/api";
const authed = { authenticated: true, user: { id: 1, login: "jaz", name: null, avatarUrl: "" }, scopes: ["public_repo"], includePrivate: false, expiresAt: "2026-12-01T00:00:00Z" };

function fakeApi(answers: Record<string, unknown>) {
  const calls: (string | undefined)[] = [];
  const fn = vi.fn(async (_path: string, opts?: ApiOptions) => {
    calls.push(opts?.baseUrl);
    const a = answers[opts?.baseUrl ?? "default"];
    if (a instanceof Error) throw a;
    return a;
  });
  return { fn: fn as unknown as <T>(p: string, o?: ApiOptions) => Promise<T>, calls };
}

describe("canonicalApiBase", () => {
  it("accepts an https origin on the same parent domain", () => {
    expect(canonicalApiBase("https://chrono-git-main-chrono8.vercel.app", API)).toBe("https://chrono-git-main-chrono8.vercel.app/api");
  });
  it("rejects http, other domains, paths and the current host", () => {
    expect(canonicalApiBase("http://chrono-git-main-chrono8.vercel.app", API)).toBeNull();
    expect(canonicalApiBase("https://evil.example.com", API)).toBeNull();
    expect(canonicalApiBase("https://chrono-git-main-chrono8.vercel.app/x", API)).toBeNull();
    expect(canonicalApiBase("https://chrono-tau.vercel.app", API)).toBeNull();
    expect(canonicalApiBase(42, API)).toBeNull();
  });
});

describe("checkSession", () => {
  it("returns the session when the server accepts the bearer token", async () => {
    const { fn } = fakeApi({ default: authed });
    expect(await checkSession(fn, API)).toEqual({ kind: "authed", session: authed });
  });

  it("retries on the canonical host instead of signing out (production since 2026-11-04)", async () => {
    const canonical = "https://chrono-git-main-chrono8.vercel.app";
    const { fn, calls } = fakeApi({ default: { authenticated: false, canonicalOrigin: canonical }, [`${canonical}/api`]: authed });
    expect(await checkSession(fn, API)).toMatchObject({ kind: "authed" });
    expect(calls).toEqual([undefined, `${canonical}/api`]);
  });

  it("keeps the token when the canonical origin is untrusted or loops", async () => {
    expect(await checkSession(fakeApi({ default: { authenticated: false, canonicalOrigin: "https://evil.example.com" } }).fn, API)).toEqual({ kind: "unreachable", code: "BACKEND_UNAVAILABLE" });
    const c = "https://chrono-git-main-chrono8.vercel.app";
    expect(await checkSession(fakeApi({ default: { authenticated: false, canonicalOrigin: c }, [`${c}/api`]: { authenticated: false, canonicalOrigin: API } }).fn, API)).toMatchObject({ kind: "unreachable" });
  });

  it("signs out only on a definitive answer", async () => {
    expect(await checkSession(fakeApi({ default: { authenticated: false } }).fn, API)).toEqual({ kind: "signed-out" });
    expect(await checkSession(fakeApi({ default: new AppError("SESSION_EXPIRED") }).fn, API)).toEqual({ kind: "signed-out" });
  });

  it("treats network failures as unreachable", async () => {
    expect(await checkSession(fakeApi({ default: new AppError("NETWORK_OFFLINE") }).fn, API)).toEqual({ kind: "unreachable", code: "NETWORK_OFFLINE" });
    expect(await checkSession(fakeApi({ default: new AppError("NETWORK_TIMEOUT") }).fn, API)).toEqual({ kind: "unreachable", code: "NETWORK_TIMEOUT" });
  });
});
