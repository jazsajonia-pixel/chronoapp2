import { createTwoFilesPatch } from "diff";
import type { FileChange } from "@/features/workspace/model";

/**
 * Git-style unified patch for workspace changes — a local backup / hand-off that works offline
 * or without push access. Apply with `git apply changes.patch`.
 */
export function toPatch(changes: readonly FileChange[]): string {
  const out: string[] = [];
  for (const c of [...changes].sort((a, b) => a.path.localeCompare(b.path))) {
    const oldText = c.status === "added" ? "" : (c.base ?? "");
    const newText = c.status === "deleted" ? "" : (c.content ?? "");
    const from = c.status === "added" ? "/dev/null" : `a/${c.path}`;
    const to = c.status === "deleted" ? "/dev/null" : `b/${c.path}`;
    const body = createTwoFilesPatch(from, to, oldText, newText, "", "", { context: 3 })
      .split("\n")
      // Drop the "Index:"/"====" preamble and the tab-suffixed headers createTwoFilesPatch emits.
      .filter((l) => !/^(Index: |={10,})/.test(l))
      .map((l) => (l.startsWith("--- ") || l.startsWith("+++ ") ? l.replace(/\t.*$/, "") : l))
      .join("\n")
      .replace(/^\n+/, "");
    out.push(`diff --git a/${c.path} b/${c.path}`);
    if (c.status === "added") out.push("new file mode 100644");
    if (c.status === "deleted") out.push("deleted file mode 100644");
    out.push(body.endsWith("\n") ? body.slice(0, -1) : body);
  }
  return out.length ? out.join("\n") + "\n" : "";
}

export function patchFileName(repo: string, branch: string, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return `${repo}-${branch.replace(/[^\w.-]+/g, "_")}-${stamp}.patch`;
}

/** Save `text` to a temp file and open the OS share sheet (no network). */
export async function downloadText(name: string, text: string, type = "text/x-diff"): Promise<void> {
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: type, dialogTitle: name, UTI: "public.plain-text" });
}
