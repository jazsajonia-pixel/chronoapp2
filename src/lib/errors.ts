/**
 * Central error vocabulary. Every failure shown in the UI maps to one of these codes so
 * messages stay consistent and understandable ("what happened" + "what to do next").
 * The same codes are emitted by the Chrono API (netlify/lib/http.ts in the website repo, served on Vercel).
 */
import { ERROR_CODES, isErrorCode, type ErrorCode } from "./error-codes";

export { ERROR_CODES, isErrorCode, type ErrorCode };

export interface ErrorCopy {
  title: string;
  hint: string;
}

const COPY: Record<ErrorCode, ErrorCopy> = {
  NETWORK_OFFLINE: {
    title: "You're offline",
    hint: "Check your connection. Unsaved work stays on this device.",
  },
  NETWORK_TIMEOUT: {
    title: "The request timed out",
    hint: "Mobile networks can be slow — try again in a moment.",
  },
  BACKEND_UNAVAILABLE: {
    title: "Can't reach Chrono",
    hint: "Chrono's server didn't answer. Check your connection and try again in a moment. Work on this device is kept.",
  },
  UNAUTHENTICATED: {
    title: "Sign in required",
    hint: "Sign in with GitHub to continue.",
  },
  SESSION_EXPIRED: {
    title: "Your session expired",
    hint: "Sign in with GitHub again to continue. Local drafts are kept.",
  },
  FORBIDDEN: {
    title: "Missing permission",
    hint: "Your GitHub account can't do this here. If it's a private repository, sign in again with private access, or ask the owner for access.",
  },
  NOT_FOUND: { title: "Not found", hint: "It may have been moved, renamed, or deleted." },
  RATE_LIMITED: {
    title: "Rate limit reached",
    hint: "Too many requests in a short time. Wait a minute and try again.",
  },
  VALIDATION_FAILED: { title: "That wasn't accepted", hint: "Check what you entered and try again." },
  GITHUB_OAUTH_NOT_CONFIGURED: {
    title: "GitHub sign-in isn't configured",
    hint: "This Chrono server isn't set up for GitHub sign-in yet. If you run it, add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and SESSION_SECRET to its environment variables.",
  },
  OAUTH_DENIED: {
    title: "GitHub access wasn't granted",
    hint: "You cancelled the GitHub authorization. Try again when you're ready.",
  },
  OAUTH_STATE_MISMATCH: {
    title: "Sign-in link expired",
    hint: "The sign-in attempt timed out or was opened in another browser. Start again from this screen.",
  },
  OAUTH_EXCHANGE_FAILED: {
    title: "GitHub sign-in failed",
    hint: "GitHub didn't complete the sign-in. Try again; if it keeps failing, the server's GitHub app settings need checking.",
  },
  GITHUB_UNAVAILABLE: {
    title: "GitHub isn't responding",
    hint: "GitHub returned a server error. Check githubstatus.com and try again shortly.",
  },
  EMPTY_REPOSITORY: {
    title: "This repository is empty",
    hint: "There are no commits yet. Push an initial commit on GitHub, then reload.",
  },
  FILE_TOO_LARGE: {
    title: "File too large to open",
    hint: "Files over 1 MB can't be opened in the editor. View it on GitHub instead.",
  },
  AI_NOT_CONFIGURED: {
    title: "Saving API keys isn't available",
    hint: "This Chrono server isn't set up to store provider keys. If you run it, set SESSION_SECRET (session-only keys) or ENCRYPTION_KEY and DATABASE_URL (saved keys).",
  },
  AI_INVALID_KEY: {
    title: "The provider rejected the API key",
    hint: "Check the key is correct, active, and has access to this model. Paste it again to replace it.",
  },
  AI_MODEL_NOT_FOUND: {
    title: "Model not available",
    hint: "This key can't use that model, or the name is wrong. Pick one from “Fetch models”.",
  },
  AI_QUOTA_EXCEEDED: {
    title: "Provider rate limit or quota reached",
    hint: "Wait a moment, or check billing and usage limits in the provider's dashboard.",
  },
  AI_PROVIDER_UNAVAILABLE: {
    title: "AI provider not responding",
    hint: "The provider timed out or returned an error. Try again, or switch to another provider.",
  },
  AI_BAD_BASE_URL: {
    title: "Base URL not allowed",
    hint: "Use a public https:// endpoint such as https://api.example.com/v1. Private and local addresses are blocked.",
  },
  AI_NO_PROVIDER: {
    title: "No AI provider configured",
    hint: "Add an API key in Settings → AI providers.",
  },
  AI_STORAGE_FULL: {
    title: "Too many session-only providers",
    hint: "Remove one to add another. Servers with encrypted key storage enabled allow more.",
  },
  BINARY_FILE: {
    title: "Binary file",
    hint: "This file isn't text (image, font, archive…) so it can't be shown in the editor.",
  },
  NOT_IMPLEMENTED: {
    title: "Not available yet",
    hint: "This isn't supported yet.",
  },
  UNSUPPORTED_PROJECT: {
    title: "Unsupported project type",
    hint: "Chrono can't run this kind of project yet. Preview → Live server lists what it supports.",
  },
  GIT_CONFLICT: {
    title: "The branch changed on GitHub",
    hint: "Someone pushed changes to the same files. Commit to a new branch instead and open a pull request — nothing was lost.",
  },
  REPO_EXISTS: { title: "That repository already exists", hint: "Pick a different name, or open the existing repository from your list." },
  SKILLS_LIMIT: { title: "Too many skills", hint: "Delete a custom skill before adding another." },
  BRANCH_EXISTS: { title: "That branch already exists", hint: "Pick another branch name, or commit to the existing branch." },
  BRANCH_PROTECTED: {
    title: "Branch is protected",
    hint: "GitHub doesn't allow direct commits to this branch. Commit to a new branch and open a pull request.",
  },
  NO_CHANGES: { title: "Nothing to commit", hint: "These changes are already on the branch." },
  INTERNAL: { title: "Something went wrong", hint: "Try again. If it keeps happening, quote the reference below when reporting it." },
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status?: number;
  /** Server request id (X-Request-Id) — quote it when reporting a problem. */
  readonly requestId?: string;
  /** Server-suggested wait before retrying (from Retry-After), in seconds. */
  readonly retryAfterSec?: number;

  constructor(code: ErrorCode, message?: string, status?: number, requestId?: string, retryAfterSec?: number) {
    super(message ?? COPY[code].title);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSec = retryAfterSec;
  }
}

/** Codes whose server message is more useful than the generic hint (it says what was wrong). */
const SPECIFIC = new Set<ErrorCode>(["VALIDATION_FAILED", "UNSUPPORTED_PROJECT", "NOT_IMPLEMENTED"]);

export function describeError(error: unknown): ErrorCopy & { code: ErrorCode; requestId?: string } {
  const code: ErrorCode = error instanceof AppError ? error.code : "INTERNAL";
  const copy = COPY[code];
  const message = error instanceof AppError ? error.message.trim() : "";
  const hint = SPECIFIC.has(code) && message && message !== copy.title ? message : copy.hint;
  return { code, title: copy.title, hint, requestId: error instanceof AppError ? error.requestId : undefined };
}

/** Map an HTTP status to the closest error code when the server didn't send one. */
export function codeFromStatus(status: number): ErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 422 || status === 400) return "VALIDATION_FAILED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 501) return "NOT_IMPLEMENTED";
  if (status === 502 || status === 503 || status === 504) return "BACKEND_UNAVAILABLE";
  return "INTERNAL";
}
