import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/features/workspace/context";
import { api } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { collectLiveFiles, sanitizeLiveResponse, type LiveServerState } from "./live-files";

/**
 * Live server preview: runs the project's own dev/start script in an isolated Vercel Sandbox through
 * the existing Chrono backend (/api/preview-server — same contract as the website). Nothing from the
 * repository ever executes on the phone; the WebView only loads the sandbox URL.
 */
export type { LiveServerResponse, LiveServerState, LiveServerStatus } from "./live-files";

function describeFailure(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return error instanceof AppError && error.requestId ? `${message} (request ${error.requestId})` : message;
}

export function useLiveServer(owner: string, repo: string) {
  const workspace = useWorkspace();
  const { commitSha, storageKey } = workspace.source;
  const [state, setState] = useState<LiveServerState>({ status: "idle" });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [frameKey, setFrameKey] = useState(0);
  const busy = useRef(false);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const generation = useRef(0);

  const apply = useCallback((gen: number, raw: unknown) => {
    if (gen !== generation.current) return;
    const result = sanitizeLiveResponse(raw);
    if (!result) {
      setState((cur) => ({ ...cur, status: "failed", error: "The preview server sent an unexpected response." }));
      return;
    }
    setState((cur) => ({ ...cur, ...result, error: undefined }));
  }, []);

  const refresh = useCallback(async () => {
    const gen = generation.current;
    const q = `owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&ref=${encodeURIComponent(commitSha)}`;
    apply(gen, await api<unknown>(`/preview-server?${q}`, { timeoutMs: 8_000 }));
  }, [owner, repo, commitSha, apply]);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const gen = generation.current;
    setState((cur) => ({ ...cur, status: "starting", error: undefined, message: "Collecting the current workspace…" }));
    try {
      const ws = workspaceRef.current;
      const { files, assets } = await collectLiveFiles(ws.paths, ws.getBuffer);
      if (gen !== generation.current) return;
      const result = await api<unknown>("/preview-server", {
        method: "POST",
        body: { action: "start", owner, repo, ref: commitSha, files, assets },
        timeoutMs: 90_000,
      });
      apply(gen, result);
    } catch (error) {
      if (gen === generation.current) setState((cur) => ({ ...cur, status: "failed", error: describeFailure(error, "Could not start the live preview.") }));
    } finally {
      busy.current = false;
    }
  }, [owner, repo, commitSha, apply]);

  const stop = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const gen = generation.current;
    setState((cur) => ({ ...cur, status: "stopping", error: undefined }));
    try {
      apply(gen, await api<unknown>("/preview-server", { method: "POST", body: { action: "stop", owner, repo, ref: commitSha }, timeoutMs: 30_000 }));
    } catch (error) {
      if (gen === generation.current) setState((cur) => ({ ...cur, status: "failed", error: describeFailure(error, "Could not stop the live preview.") }));
    } finally {
      busy.current = false;
    }
  }, [owner, repo, commitSha, apply]);

  const reload = useCallback(() => setFrameKey((k) => k + 1), []);

  // Poll quickly while the sandbox boots, slowly while it runs (it expires after ~10 minutes).
  useEffect(() => {
    if (state.status !== "starting" && state.status !== "running") return;
    const timer = setInterval(() => void refresh().catch(() => undefined), state.status === "starting" ? 2_500 : 10_000);
    return () => clearInterval(timer);
  }, [state.status, refresh]);

  // A different branch/commit is a different sandbox: reset, and release the old one on the way out.
  useEffect(() => {
    generation.current += 1;
    setState({ status: "idle" });
    return () => {
      generation.current += 1;
      const prev = stateRef.current.status;
      if (prev === "running" || prev === "starting" || prev === "stopping") {
        void api("/preview-server", { method: "POST", body: { action: "stop", owner, repo, ref: commitSha }, timeoutMs: 30_000 }).catch(() => undefined);
      }
    };
  }, [owner, repo, storageKey, commitSha]);

  return { state, start, stop, refresh, reload, frameKey };
}
