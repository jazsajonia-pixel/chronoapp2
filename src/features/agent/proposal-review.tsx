import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AlertTriangle, Check, ChevronDown, FileDiff as FileDiffIcon, MonitorPlay, X } from "lucide-react-native";
import { DiffView } from "@/features/git/diff-view";
import { diffChange } from "@/features/git/diff";
import { proposalFiles, statusOf, type Proposal, type ProposedFile } from "./proposal";
import { Btn, Row, Sheet, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme, type ColorName } from "@/ui/theme";

const LETTER = { added: "A", modified: "M", deleted: "D" } as const;
const LETTER_COLOR: Record<keyof typeof LETTER, ColorName> = { added: "primary", modified: "warning", deleted: "danger" };

export function toDiff(f: ProposedFile) {
  const status = statusOf(f);
  return diffChange({ path: f.path, status, content: f.after ?? undefined, base: f.before ?? undefined });
}

interface ReviewActions {
  onAccept: (paths: string[]) => Promise<void>;
  onReject: (paths: string[]) => void;
  conflictsFor: (files: ProposedFile[]) => Promise<string[]>;
}

/** Inline summary of the task's proposed changes. */
export function ProposalSummary({ proposal, onReview, onPreview }: { proposal: Proposal; onReview: () => void; onPreview?: () => void }) {
  const { c, a } = useTheme();
  const files = proposalFiles(proposal);
  if (!files.length) return null;
  const pending = files.filter((f) => f.decision === "pending").length;
  return (
    <View accessibilityLabel="Proposed changes" testID="card-proposal" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: pending ? a("primary", 0.45) : c.border, backgroundColor: pending ? a("primary", 0.06) : c.surface, padding: 12, gap: 8 }}>
      <Row gap={8}>
        <FileDiffIcon size={16} color={c.primary} />
        <T variant="h3" style={{ flex: 1, fontSize: 14 }}>{pending ? "Proposed changes" : "Changes reviewed"}</T>
        <T variant="tiny">{files.length} file{files.length === 1 ? "" : "s"}</T>
      </Row>
      <T variant="small">{pending ? `${pending} file${pending === 1 ? "" : "s"} waiting for your review` : "All proposed files have been reviewed."}</T>
      {pending ? (
        <Btn label={`Show files · Review ${pending} change${pending === 1 ? "" : "s"}`} onPress={onReview} testID="button-review-changes" />
      ) : onPreview && files.some((f) => f.decision === "accepted") ? (
        <Btn label="Preview changes" icon={MonitorPlay} variant="secondary" onPress={onPreview} testID="link-preview-changes" />
      ) : null}
    </View>
  );
}

/** Full-height review sheet: diff per file, accept / reject per file or all. */
export function ReviewSheet({ open, onOpenChange, proposal, ...actions }: { open: boolean; onOpenChange: (o: boolean) => void; proposal: Proposal } & ReviewActions) {
  const { c, a } = useTheme();
  const files = useMemo(() => proposalFiles(proposal).filter((f) => f.decision === "pending"), [proposal]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ paths: string[]; deletions: string[]; conflicts: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = expanded ?? files[0]?.path ?? null;

  async function requestAccept(paths: string[]) {
    const sel = files.filter((f) => paths.includes(f.path));
    const deletions = sel.filter((f) => f.after === null).map((f) => f.path);
    const conflicts = await actions.conflictsFor(sel);
    if (deletions.length || conflicts.length) setConfirm({ paths, deletions, conflicts });
    else await doAccept(paths);
  }
  async function doAccept(paths: string[]) {
    setBusy(true);
    try {
      await actions.onAccept(paths);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
    if (files.length <= paths.length) onOpenChange(false);
  }

  // The confirmation replaces the sheet's content (no stacked modals on native).
  if (confirm) {
    return (
      <Sheet
        open={open}
        onClose={() => setConfirm(null)}
        title="Apply these changes?"
        footer={
          <Row>
            <Btn label="Cancel" variant="outline" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
            <Btn label="Apply" variant={confirm.deletions.length ? "danger" : "primary"} loading={busy} onPress={() => void doAccept(confirm.paths)} style={{ flex: 1 }} />
          </Row>
        }
      >
        <View testID="confirm-apply" style={{ gap: 10 }}>
          {confirm.deletions.length ? (
            <T variant="small" color="foreground">
              Deletes {confirm.deletions.length} file{confirm.deletions.length === 1 ? "" : "s"}: <T variant="monoSmall" color="danger">{confirm.deletions.join(", ")}</T>
            </T>
          ) : null}
          {confirm.conflicts.length ? (
            <T variant="small" color="warning">
              Changed since the agent read {confirm.conflicts.length === 1 ? "it" : "them"} — applying overwrites your edits in <T variant="monoSmall" color="warning">{confirm.conflicts.join(", ")}</T>.
            </T>
          ) : null}
          <T variant="small">You can still discard changes in the Git tab afterwards.</T>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title="Review proposed changes"
      description="Accepted files are saved to your workspace. Nothing is committed or pushed to GitHub."
      full
      footer={
        files.length ? (
          <Row>
            <Btn label="Reject all" variant="secondary" disabled={busy} onPress={() => actions.onReject(files.map((f) => f.path))} style={{ flex: 1 }} testID="button-reject-all" />
            <Btn label={`Accept all (${files.length})`} icon={Check} loading={busy} onPress={() => void requestAccept(files.map((f) => f.path))} style={{ flex: 1 }} testID="button-accept-all" />
          </Row>
        ) : undefined
      }
    >
      {files.length === 0 ? (
        <T variant="small">Everything has been reviewed.</T>
      ) : (
        <View style={{ gap: 10 }}>
          {files.map((f) => {
            const st = statusOf(f);
            const d = toDiff(f);
            const isOpen = shown === f.path;
            return (
              <View key={f.path} testID={`review-file-${f.path}`} style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden", backgroundColor: c.surface }}>
                <Pressable onPress={() => setExpanded(isOpen ? "" : f.path)} accessibilityState={{ expanded: isOpen }} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: a(LETTER_COLOR[st], 0.14) }}>
                    <Text style={{ fontFamily: FONT.monoMedium, fontSize: 11, color: c[LETTER_COLOR[st]] }}>{LETTER[st]}</Text>
                  </View>
                  <T variant="mono" numberOfLines={1} ellipsizeMode="head" style={{ flex: 1, fontSize: 13 }}>{f.path}</T>
                  <T variant="monoSmall">
                    <T variant="monoSmall" style={{ color: c.diffAdd }}>+{d.added}</T> <T variant="monoSmall" style={{ color: c.diffDel }}>−{d.removed}</T>
                  </T>
                  <View style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}>
                    <ChevronDown size={15} color={c.mutedForeground} />
                  </View>
                </Pressable>
                {f.renamedFrom ? <T variant="tiny" style={{ paddingHorizontal: 12, paddingBottom: 6 }}>Renamed from {f.renamedFrom}</T> : null}
                {f.after === null ? (
                  <Row gap={6} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                    <AlertTriangle size={13} color={c.danger} />
                    <T variant="tiny" color="danger" style={{ flex: 1 }}>Deletes this file{f.reason ? ` — ${f.reason}` : ""}</T>
                  </Row>
                ) : null}
                {isOpen ? (
                  <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
                    <DiffView diff={d} />
                  </View>
                ) : null}
                <Row gap={6} style={{ justifyContent: "flex-end", padding: 8, borderTopWidth: 1, borderTopColor: c.border }}>
                  <Btn label="Reject" icon={X} variant="ghost" size="sm" disabled={busy} onPress={() => actions.onReject([f.path])} testID="button-reject-file" />
                  <Btn label="Accept" icon={Check} variant="secondary" size="sm" disabled={busy} onPress={() => void requestAccept([f.path])} testID="button-accept-file" />
                </Row>
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
