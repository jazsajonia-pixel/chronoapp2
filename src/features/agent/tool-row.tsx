import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { CheckCircle2, ChevronDown, FilePen, FilePlus2, FileSearch, FileText, FileX2, FolderTree, GitCompare, MonitorPlay, Package, Replace, XCircle } from "lucide-react-native";
import { TOOLS, isToolName, type ToolName } from "@/lib/agent-tools";
import type { AgentMessage, ToolCall } from "@/types/agent";
import { T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const ICON: Record<ToolName, typeof FileText> = {
  list_files: FolderTree,
  read_file: FileText,
  search_code: FileSearch,
  get_git_status: GitCompare,
  inspect_package_json: Package,
  request_preview: MonitorPlay,
  propose_plan: FileText,
  create_file: FilePlus2,
  update_file: FilePen,
  apply_patch: Replace,
  delete_file: FileX2,
  rename_file: FilePen,
};

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Human summary of a tool call, e.g. "Read src/App.tsx". */
export function describeCall(c: ToolCall): string {
  const a = c.args ?? {};
  switch (c.name) {
    case "list_files":
      return `List files${s(a.path) ? ` in ${s(a.path)}` : ""}${s(a.pattern) ? ` matching ${s(a.pattern)}` : ""}`;
    case "read_file":
      return `Read ${s(a.path)}${a.start_line ? ` (from line ${String(a.start_line)})` : ""}`;
    case "search_code":
      return `Search “${s(a.query)}”${s(a.path) ? ` in ${s(a.path)}` : ""}`;
    case "get_git_status":
      return "Check workspace changes";
    case "inspect_package_json":
      return "Inspect package.json";
    case "request_preview":
      return `Check the preview${s(a.page) ? ` (${s(a.page)})` : ""}`;
    case "create_file":
      return `Create ${s(a.path)}`;
    case "update_file":
      return `Rewrite ${s(a.path)}`;
    case "apply_patch":
      return `Edit ${s(a.path)}${Array.isArray(a.edits) ? ` · ${a.edits.length} change${a.edits.length === 1 ? "" : "s"}` : ""}`;
    case "delete_file":
      return `Delete ${s(a.path)}`;
    case "rename_file":
      return `Rename ${s(a.from)} → ${s(a.to)}`;
    default:
      return c.name;
  }
}

/** One logged tool call. Every call the model makes is shown; tap to see arguments and output. */
export function ToolRow({ call, result, running }: { call: ToolCall; result?: Extract<AgentMessage, { role: "tool" }>; running: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const def = isToolName(call.name) ? TOOLS[call.name] : null;
  const Icon = def ? ICON[def.name] : FileText;
  const write = def?.kind === "write";
  const danger = !!def?.dangerous;
  const status = result ? (result.isError ? "error" : "ok") : running ? "running" : "skipped";
  const args = call.args ? Object.fromEntries(Object.entries(call.args).map(([k, v]) => [k, typeof v === "string" && v.length > 600 ? `${v.slice(0, 600)}… (${v.length} chars)` : v])) : call.rawArgs;
  const pre = { fontFamily: FONT.mono, fontSize: 11, lineHeight: 16, color: c.foreground } as const;
  return (
    <View testID={`tool-${call.name}`} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityState={{ expanded: open }} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 10, backgroundColor: pressed ? c.surface2 : "transparent" })}>
        <Icon size={14} color={danger ? c.danger : write ? c.primary : c.mutedForeground} />
        <T variant="small" color="foreground" numberOfLines={1} style={{ flex: 1, fontFamily: FONT.mono, fontSize: 12 }}>{describeCall(call)}</T>
        {write && status === "ok" ? <T variant="tiny" color="primary">proposed</T> : null}
        {status === "running" ? <ActivityIndicator size="small" color={c.primary} /> : null}
        {status === "ok" ? <CheckCircle2 size={14} color={c.success} /> : null}
        {status === "error" ? <XCircle size={14} color={c.danger} /> : null}
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={14} color={c.mutedForeground} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.border, padding: 10, gap: 6, backgroundColor: c.background }}>
          <T variant="tiny">{call.name}</T>
          <ScrollView horizontal style={{ maxHeight: 200 }}>
            <Text selectable style={pre}>{typeof args === "string" ? args : JSON.stringify(args, null, 2)}</Text>
          </ScrollView>
          {result ? (
            <ScrollView style={{ maxHeight: 240, borderRadius: RADIUS.sm, backgroundColor: c.muted }} contentContainerStyle={{ padding: 8 }} nestedScrollEnabled>
              <Text selectable style={[pre, result.isError ? { color: c.danger } : null]}>{result.content}</Text>
            </ScrollView>
          ) : (
            <T variant="tiny">{running ? "Running…" : "Not run."}</T>
          )}
        </View>
      ) : null}
    </View>
  );
}
