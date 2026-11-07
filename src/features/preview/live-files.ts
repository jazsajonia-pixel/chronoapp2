import { AppError } from "@/lib/errors";

/**
 * Which workspace files a Live server preview uploads, and the limits it enforces — the same rules
 * as the website (chrono src/features/preview/use-live-server.ts) and the /api/preview-server schema
 * (≤ 350 text files, ≤ 500 KB each, ≤ 1.8 MB total). Binary assets are copied server-side from
 * GitHub at the pinned commit; secrets and generated folders are never sent.
 */
export const LIVE_LIMITS = { maxFiles: 350, maxFileBytes: 500_000, maxBytes: 1_800_000, concurrency: 8 } as const;

const OMIT_SEGMENTS = new Set([".git", ".vercel", ".next", ".nuxt", ".cache", ".turbo", "node_modules", "coverage", "dist", "build", ".ssh", ".aws", ".azure"]);
const OMIT_FILES = new Set([".npmrc", ".yarnrc", ".pypirc", ".netrc", "credentials", "id_rsa", "id_ed25519"]);
const SECRET_EXTENSIONS = new Set(["pem", "key", "p12", "pfx", "jks", "keystore"]);
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "ico", "pdf", "zip", "gz", "mp4", "mov", "webm", "woff", "woff2", "ttf", "otf", "eot", "wasm", "psd",
  "sketch", "sqlite", "db", "avif", "bmp", "tif", "tiff", "heic", "jfif", "mp3", "wav", "ogg", "m4a", "flac", "glb", "bin",
]);
const SKIPPABLE = new Set<string>(["NOT_FOUND", "BINARY_FILE", "FILE_TOO_LARGE"]);

function omitted(path: string): boolean {
  return path.split("/").some((part) => {
    const p = part.toLowerCase();
    return OMIT_SEGMENTS.has(p) || OMIT_FILES.has(p) || /^\.env(?:$|\.)/i.test(part);
  });
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
}

export type LiveFileKind = "text" | "asset" | "omit";

export function classifyLiveFile(path: string): LiveFileKind {
  if (omitted(path)) return "omit";
  const ext = extension(path);
  if (SECRET_EXTENSIONS.has(ext)) return "omit";
  return BINARY_EXTENSIONS.has(ext) ? "asset" : "text";
}

/** UTF-8 byte length without allocating an encoded copy (large files on low-RAM phones). */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export interface CollectedFiles {
  files: { path: string; content: string }[];
  assets: string[];
  skipped: string[];
  bytes: number;
}

/**
 * Read the workspace (edits included, via `read`) with bounded concurrency. Files GitHub can't serve
 * as text become server-copied assets or are skipped; any other failure names the file.
 */
export async function collectLiveFiles(paths: readonly string[], read: (path: string) => Promise<string>, signal?: { cancelled: boolean }): Promise<CollectedFiles> {
  const assets: string[] = [];
  const text: string[] = [];
  for (const p of paths) {
    const kind = classifyLiveFile(p);
    if (kind === "asset") assets.push(p);
    else if (kind === "text") text.push(p);
  }
  if (text.length > LIVE_LIMITS.maxFiles) {
    throw new Error(`Live preview supports up to ${LIVE_LIMITS.maxFiles} text files (this project has ${text.length}). Remove generated or unused files and retry.`);
  }
  const contents: ({ path: string; content: string } | null)[] = new Array(text.length).fill(null);
  const skipped: string[] = [];
  let bytes = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < text.length) {
      if (signal?.cancelled) return;
      const index = cursor++;
      const path = text[index]!;
      let content: string;
      try {
        content = await read(path);
      } catch (err) {
        if (err instanceof AppError && (err.code === "BINARY_FILE" || err.code === "FILE_TOO_LARGE")) {
          assets.push(path);
          continue;
        }
        if (err instanceof AppError && SKIPPABLE.has(err.code)) {
          skipped.push(path);
          continue;
        }
        throw new Error(`Couldn't load ${path}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
      const size = utf8Length(content);
      if (size > LIVE_LIMITS.maxFileBytes) throw new Error(`${path} is too large to include in a live preview.`);
      if (bytes + size > LIVE_LIMITS.maxBytes) throw new Error("This workspace exceeds the 1.8 MB live preview limit. Remove large files and retry.");
      bytes += size;
      contents[index] = { path, content };
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIVE_LIMITS.concurrency, text.length) }, worker));
  const files = contents.filter((f): f is { path: string; content: string } => f !== null);
  if (!signal?.cancelled && files.length === 0) {
    throw new Error(skipped.length ? `Chrono couldn't load any project files from GitHub (${skipped.length} skipped). Reload and try again.` : "This workspace has no text files to run.");
  }
  return { files, assets, skipped, bytes };
}

export type LiveServerStatus = "idle" | "starting" | "running" | "stopping" | "stopped" | "failed";

export interface LiveServerResponse {
  status: LiveServerStatus;
  url?: string;
  message?: string;
  logs?: string;
  files?: number;
  bytes?: number;
  assets?: number;
  assetBytes?: number;
  skippedAssets?: string[];
}

export interface LiveServerState extends LiveServerResponse {
  error?: string;
}

const STATUSES = new Set<LiveServerStatus>(["idle", "starting", "running", "stopping", "stopped", "failed"]);

/** Only accept a well-formed response; a public https URL is the only thing the WebView may load. */
export function sanitizeLiveResponse(raw: unknown): LiveServerResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== "string" || !STATUSES.has(r.status as LiveServerStatus)) return null;
  const out: LiveServerResponse = { status: r.status as LiveServerStatus };
  if (typeof r.url === "string" && /^https:\/\/[^\s]+$/i.test(r.url)) out.url = r.url;
  if (typeof r.message === "string") out.message = r.message;
  if (typeof r.logs === "string") out.logs = r.logs.slice(-20_000);
  for (const k of ["files", "bytes", "assets", "assetBytes"] as const) if (typeof r[k] === "number") out[k] = r[k] as number;
  if (Array.isArray(r.skippedAssets)) out.skippedAssets = r.skippedAssets.filter((s): s is string => typeof s === "string").slice(0, 50);
  return out;
}
