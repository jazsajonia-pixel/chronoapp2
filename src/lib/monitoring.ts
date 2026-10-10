/**
 * Client-side error reporting → POST /api/client-errors (server logs, redacted).
 * Sends only: message, a trimmed stack, the route (hash path, no query), app version and a coarse
 * user agent. Never file contents, prompts, tokens or keys. Capped per page load and de-duplicated.
 */
import Constants from "expo-constants";
import { API_BASE } from "./config";

export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";

const MAX_REPORTS = 5;
let sent = 0;
const seen = new Set<string>();

export interface ClientErrorReport {
  kind: "boundary" | "error" | "unhandledrejection";
  message: string;
  stack?: string;
  route: string;
  release: string;
}

let currentRoute = "/";
/** Set by the router layout (pathname only). */
export function setMonitoringRoute(path: string): void {
  currentRoute = path;
}

function route(): string {
  // Keep the route shape but drop repo/file names after /project/.
  return (currentRoute.split("?")[0] ?? "/").replace(/^(\/project)\/[^/]+\/[^/]+/, "$1/:owner/:repo").slice(0, 120) || "/";
}

function trimStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, 12)
    .map((l) => l.replace(/\?[^\s):]*/g, "").slice(0, 300))
    .join("\n");
}

export function buildReport(kind: ClientErrorReport["kind"], err: unknown): ClientErrorReport {
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : "Non-error thrown");
  return { kind, message: e.message.slice(0, 300) || e.name, stack: trimStack(e.stack), route: route(), release: APP_VERSION };
}

export function reportError(kind: ClientErrorReport["kind"], err: unknown, send: (r: ClientErrorReport) => void = post): boolean {
  if (sent >= MAX_REPORTS) return false;
  const report = buildReport(kind, err);
  const key = `${report.kind}|${report.message}`;
  if (seen.has(key)) return false;
  seen.add(key);
  sent += 1;
  try {
    send(report);
  } catch {
    /* never let reporting throw */
  }
  return true;
}

function post(report: ClientErrorReport): void {
  void fetch(`${API_BASE}/client-errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => {});
}

/** Install the global JS error handler (once) — reports, then defers to React Native's default. */
let installed = false;
export function installErrorReporting(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } };
  const prev = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((e, fatal) => {
    if (!(e && typeof e === "object" && (e as { name?: string }).name === "AppError")) reportError("error", e);
    prev?.(e, fatal);
  });
}

/** Test helper. */
export function _resetReporting(): void {
  sent = 0;
  seen.clear();
}
