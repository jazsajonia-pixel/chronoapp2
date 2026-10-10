import type { BuildResult } from "./bundler";
import { locate } from "./use-preview";

export interface ProbeReport {
  booted: boolean;
  errors: { message: string; where: string | null }[];
  console: { level: string; text: string }[];
}

/** A pending probe; rendered as a hidden WebView by <ProbeHost/> (mounted once in the root layout). */
export interface ProbeJob {
  id: number;
  html: string;
  onMessage: (raw: string) => void;
}

let jobs: ProbeJob[] = [];
const listeners = new Set<() => void>();
let seq = 0;
const notify = () => listeners.forEach((l) => l());

export const probeJobs = {
  get: () => jobs,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/**
 * Runs a built preview in a hidden WebView for a few seconds and collects runtime errors and
 * console warnings/errors — used by the agent's `request_preview` tool. Same isolation as the
 * visible preview (messages accepted only with this build's nonce).
 */
export function probePreview(result: BuildResult, opts: { timeoutMs?: number; settleMs?: number } = {}): Promise<ProbeReport> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const settleMs = opts.settleMs ?? 1200;
  return new Promise((resolve) => {
    const report: ProbeReport = { booted: false, errors: [], console: [] };
    const id = ++seq;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(settle);
      clearTimeout(hard);
      jobs = jobs.filter((j) => j.id !== id);
      notify();
      resolve(report);
    };
    const str = (v: unknown, n = 2000) => (typeof v === "string" ? v.slice(0, n) : "");
    const onMessage = (raw: string) => {
      let d: Record<string, unknown> | null = null;
      try {
        d = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return;
      }
      if (!d || typeof d !== "object" || d.__mdai !== result.nonce) return;
      if (d.type === "ready") {
        report.booted = true;
        settle = setTimeout(done, settleMs);
      } else if (d.type === "error" && report.errors.length < 10) {
        const loc = locate(str(d.stack, 4000), result.sources);
        report.errors.push({ message: str(d.message), where: loc.file ? `${loc.file}${loc.line ? `:${loc.line}` : ""}` : null });
      } else if (d.type === "console" && (d.level === "warn" || d.level === "error") && report.console.length < 20) {
        report.console.push({ level: d.level, text: str(d.text, 500) });
      }
    };
    const hard = setTimeout(done, timeoutMs);
    jobs = [...jobs, { id, html: result.html, onMessage }];
    notify();
  });
}
