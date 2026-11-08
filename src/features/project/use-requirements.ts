import { useEffect, useState } from "react";
import { useWorkspace } from "@/features/workspace/context";
import { analyzeRequirements, type ProjectRequirements } from "./requirements";

/**
 * Requirements for the open workspace, recomputed when the commit or file list changes. Reads go
 * through the workspace (drafts → saved → GitHub base, cached), so a frontend-only project costs
 * one or two small reads. `null` while analysing or if reading failed.
 */
export function useProjectRequirements(): ProjectRequirements | null {
  const ws = useWorkspace();
  const [result, setResult] = useState<{ key: string; value: ProjectRequirements | null } | null>(null);
  const key = `${ws.source.storageKey}|${ws.source.commitSha}|${ws.paths.length}`;
  const { paths, getBuffer } = ws;

  useEffect(() => {
    let cancelled = false;
    const read = (p: string) => getBuffer(p).then((t) => t || null).catch(() => null);
    analyzeRequirements(paths, read)
      .then((value) => !cancelled && setResult({ key, value }))
      .catch(() => !cancelled && setResult({ key, value: null }));
    return () => {
      cancelled = true;
    };
    // `key` captures the inputs that matter; paths identity changes on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return result?.key === key ? result.value : null;
}
