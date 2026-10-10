import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ArrowRight, Trash2 } from "lucide-react-native";
import { ShippedNote } from "@/features/git/shipped-note";
import { projectPath } from "@/lib/nav";
import { HISTORY_STATUS_LABEL, type HistoryEntry, type HistoryStatus } from "./history";
import { Badge, Btn, Row, Sheet, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

export const STATUS_TONE: Record<HistoryStatus, "muted" | "primary" | "warning" | "danger"> = {
  in_progress: "muted",
  needs_review: "warning",
  done: "muted",
  shipped: "primary",
  failed: "danger",
};

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Dl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row center={false} gap={12}>
      <T variant="small" style={{ width: 86 }}>{label}</T>
      <View style={{ flex: 1 }}>{typeof children === "string" ? <T variant="small" color="foreground">{children}</T> : children}</View>
    </Row>
  );
}

/** Everything stored about one AI task: prompt, repo, branch, files, result, time, status, commit/PR. */
export function TaskDetailSheet({ entry, onOpenChange, onDelete }: { entry: HistoryEntry | null; onOpenChange: (open: boolean) => void; onDelete: (e: HistoryEntry) => void }) {
  const [confirm, setConfirm] = useState(false);
  const { c } = useTheme();
  const e = entry;
  const decisionColor = (d: string) => (d === "accepted" ? c.success : d === "pending" ? c.warning : c.mutedForeground);
  return (
    <>
      <Sheet
        open={!!e}
        onClose={() => (setConfirm(false), onOpenChange(false))}
        title={e?.ref.task.title ?? "Task"}
        footer={
          e && confirm ? (
            <View style={{ gap: 8 }}>
              <T variant="small">Delete this task? Removes the conversation and tool log from this device. Workspace files and commits are not affected.</T>
              <Row>
                <Btn label="Cancel" variant="outline" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
                <Btn
                  label="Delete task"
                  variant="danger"
                  onPress={() => {
                    setConfirm(false);
                    onDelete(e);
                  }}
                  style={{ flex: 1 }}
                  testID="button-confirm-delete-task"
                />
              </Row>
            </View>
          ) : e ? (
            <Row>
              <Btn label="Delete" icon={Trash2} variant="secondary" onPress={() => setConfirm(true)} style={{ flex: 1 }} testID="button-delete-task" />
              <Btn
                label="Open project"
                iconRight={ArrowRight}
                onPress={() => {
                  onOpenChange(false);
                  router.push(projectPath(e.ref.owner, e.ref.repo, "ai"));
                }}
                style={{ flex: 1 }}
                testID="link-open-task-project"
              />
            </Row>
          ) : null
        }
      >
        {e ? (
          <View style={{ gap: 16 }} testID="task-detail">
            <Row>
              <Badge label={HISTORY_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />
              <Badge label={e.ref.task.mode} />
            </Row>
            <View style={{ gap: 6 }}>
              <Dl label="Repository"><T variant="mono">{e.ref.owner}/{e.ref.repo}</T></Dl>
              <Dl label="Branch"><T variant="mono">{e.ref.branch}</T></Dl>
              <Dl label="Started">{fmt(e.ref.task.createdAt)}</Dl>
              <Dl label="Updated">{fmt(e.ref.task.updatedAt)}</Dl>
              {e.ref.task.provider ? (
                <Dl label="Model">
                  <T variant="small" color="foreground">
                    {e.ref.task.provider.label} · <T variant="monoSmall">{e.ref.task.provider.model}</T>
                    {e.ref.task.usage.inputTokens ? ` · ${e.ref.task.usage.inputTokens + e.ref.task.usage.outputTokens} tokens` : ""}
                  </T>
                </Dl>
              ) : null}
            </View>
            <View style={{ gap: 6 }}>
              <T variant="label">Prompt</T>
              <View style={{ borderRadius: RADIUS.md, backgroundColor: c.background, borderWidth: 1, borderColor: c.border, padding: 12 }}>
                <T variant="small" color="foreground" selectable testID="text-task-prompt">{e.prompt}</T>
              </View>
              {e.attached.length ? <T variant="tiny">Attached: {e.attached.join(", ")}</T> : null}
            </View>
            <View style={{ gap: 6 }}>
              <T variant="label">Files changed ({e.files.length})</T>
              {e.files.length ? (
                <View testID="list-task-files" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border }}>
                  {e.files.map((f, i) => (
                    <Row key={f.path} style={{ paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                      <T variant="monoSmall" color="foreground" numberOfLines={1} style={{ flex: 1 }}>{f.path}</T>
                      <T variant="tiny" style={{ color: decisionColor(f.decision), textDecorationLine: f.decision === "rejected" ? "line-through" : "none" }}>
                        {f.after === null ? `delete · ${f.decision}` : f.decision}
                      </T>
                    </Row>
                  ))}
                </View>
              ) : (
                <T variant="small">No file changes{e.ref.task.mode === "ask" ? " (Ask mode)" : ""}.</T>
              )}
            </View>
            {e.result ? (
              <View style={{ gap: 6 }}>
                <T variant="label">{e.status === "failed" && e.ref.task.error ? "Error" : "Result"}</T>
                <T variant="small" color="foreground" selectable testID="text-task-result">{e.result}</T>
              </View>
            ) : null}
            <View style={{ gap: 6 }}>
              <T variant="label">Commit / PR</T>
              {e.ref.task.shipped ? <ShippedNote info={e.ref.task.shipped} /> : <T variant="small">Not committed yet.</T>}
            </View>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
