import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertTriangle, Check, ChevronRight, Download, FilePen, RotateCcw, ShieldAlert, GitCommitHorizontal } from "lucide-react-native";
import { useWorkspace } from "@/features/workspace/context";
import type { FileChange } from "@/features/workspace/model";
import { diffChange } from "./diff";
import { DiffView } from "./diff-view";
import { ShipPanel, type GitTarget } from "./ship-panel";
import { downloadText, patchFileName, toPatch } from "./patch";
import { GitStatus } from "./git-status";
import { Btn, ConfirmSheet, EmptyState, IconBtn, Row, T, haptic, toast } from "@/ui/kit";
import { FONT, RADIUS, useTheme, type ColorName } from "@/ui/theme";

const STATUS: Record<FileChange["status"], { letter: string; color: ColorName; label: string }> = {
  added: { letter: "A", color: "diffAdd", label: "Added" },
  modified: { letter: "M", color: "warning", label: "Modified" },
  deleted: { letter: "D", color: "diffDel", label: "Deleted" },
};

function Checkbox({ on, onPress, label, testID }: { on: boolean; onPress: () => void; label: string; testID: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} testID={testID} style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? c.primary : c.mutedForeground, backgroundColor: on ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
      {on ? <Check size={14} color={c.primaryForeground} strokeWidth={3} /> : null}
    </Pressable>
  );
}

function ChangeRow({ change, onDiscard, onOpen, selected, onToggle, first }: { change: FileChange; onDiscard: () => void; onOpen?: () => void; selected: boolean; onToggle: () => void; first: boolean }) {
  const { c, a } = useTheme();
  const [open, setOpen] = useState(false);
  const diff = useMemo(() => diffChange(change), [change]);
  const s = STATUS[change.status];
  const slash = change.path.lastIndexOf("/");
  return (
    <View testID={`change-${change.path}`} style={{ borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <Row gap={6} style={{ paddingLeft: 12, paddingRight: 4, minHeight: 52 }}>
        <Checkbox on={selected} onPress={onToggle} label={`Include ${change.path} in the commit`} testID={`checkbox-${change.path}`} />
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityState={{ expanded: open }} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingLeft: 4 }}>
          <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
            <ChevronRight size={15} color={c.mutedForeground} />
          </View>
          <View accessibilityLabel={s.label} style={{ width: 20, height: 20, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: a(s.color, 0.14) }}>
            <Text style={{ fontFamily: FONT.monoMedium, fontSize: 11, color: c[s.color] }}>{s.letter}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="mono" numberOfLines={1} color="foreground" style={{ fontSize: 13 }}>{change.path.slice(slash + 1)}</T>
            {slash > 0 ? <T variant="tiny" numberOfLines={1}>{change.path.slice(0, slash)}</T> : null}
          </View>
          <T variant="monoSmall">
            <T variant="monoSmall" style={{ color: c.diffAdd }}>+{diff.added}</T> <T variant="monoSmall" style={{ color: c.diffDel }}>−{diff.removed}</T>
          </T>
        </Pressable>
        {onOpen ? <IconBtn icon={FilePen} label={`Edit ${change.path}`} size={36} onPress={onOpen} /> : null}
        <IconBtn icon={RotateCcw} label={`Discard changes to ${change.path}`} size={36} onPress={onDiscard} testID={`button-discard-${change.path}`} />
      </Row>
      {open ? <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}><DiffView diff={diff} /></View> : null}
    </View>
  );
}

function Note({ tone, icon: Icon, title, children }: { tone: "warning" | "danger" | "muted"; icon: typeof AlertTriangle; title: string; children: string }) {
  const { c, a } = useTheme();
  const col = tone === "muted" ? c.mutedForeground : c[tone];
  return (
    <Row center={false} gap={8} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: tone === "muted" ? c.border : a(tone, 0.4), backgroundColor: tone === "muted" ? c.surface2 : a(tone, 0.08), padding: 12 }}>
      <Icon size={16} color={col} style={{ marginTop: 1 }} />
      <T variant="small" style={{ flex: 1 }}>
        <T variant="small" weight="semibold" color="foreground">{title}</T> {children}
      </T>
    </Row>
  );
}

/** Git tab: review local changes as diffs, pick files, commit/push/PR, branch status. */
export function ChangesPanel({ target, onEdit, version = 0 }: { target: GitTarget; onEdit: (path: string) => void; version?: number }) {
  const { c } = useTheme();
  const { branch, canPush } = target;
  const ws = useWorkspace();
  const [discard, setDiscard] = useState<string | "all" | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const selected = useMemo(() => ws.changes.filter((x) => !excluded.has(x.path)), [ws.changes, excluded]);
  const toggle = (path: string) => {
    haptic.tap();
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const allSelected = selected.length === ws.changes.length;
  const drafts = Object.keys(ws.data.drafts);
  const totals = useMemo(() => {
    let a = 0;
    let r = 0;
    for (const x of ws.changes) {
      const d = diffChange(x);
      a += d.added;
      r += d.removed;
    }
    return { a, r };
  }, [ws.changes]);
  const patchCount = selected.length || ws.changes.length;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {ws.baseMoved ? <Note tone="warning" icon={AlertTriangle} title={`${branch} moved on GitHub.`}>Your changes were made on an older commit. They're kept; conflicts are checked before committing.</Note> : null}
      {!ws.storageOk ? <Note tone="danger" icon={AlertTriangle} title="Changes aren't being saved on this device.">Device storage is full or unavailable — don't close the app.</Note> : null}

      {ws.changes.length === 0 ? (
        <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, borderStyle: "dashed" }}>
          <EmptyState icon={GitCommitHorizontal} title="Working tree clean">{`On ${branch}. Edit a file and save it to see the diff here.`}</EmptyState>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Row gap={6}>
            <T variant="h3" style={{ flex: 1 }}>
              {ws.changes.length} changed file{ws.changes.length === 1 ? "" : "s"}{"  "}
              <T variant="monoSmall" style={{ color: c.diffAdd }}>+{totals.a}</T> <T variant="monoSmall" style={{ color: c.diffDel }}>−{totals.r}</T>
            </T>
            <Btn label={allSelected ? "None" : "All"} variant="ghost" size="sm" onPress={() => setExcluded(allSelected ? new Set(ws.changes.map((x) => x.path)) : new Set())} testID="button-toggle-all" />
            <Btn label="Discard all" variant="ghost" size="sm" onPress={() => setDiscard("all")} testID="button-discard-all" />
          </Row>
          <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
            {ws.changes.map((x, i) => (
              <ChangeRow key={x.path} first={i === 0} change={x} selected={!excluded.has(x.path)} onToggle={() => toggle(x.path)} onDiscard={() => setDiscard(x.path)} onOpen={x.status === "deleted" ? undefined : () => onEdit(x.path)} />
            ))}
          </View>
          <Row style={{ justifyContent: "space-between" }}>
            <T variant="tiny">Saved on this device until you commit.</T>
            <Btn
              label=".patch"
              icon={Download}
              variant="ghost"
              size="sm"
              testID="button-download-patch"
              onPress={() => void downloadText(patchFileName(target.repo, branch), toPatch(selected.length ? selected : ws.changes)).catch(() => toast("Couldn't export the patch.", "danger"))}
            />
          </Row>
        </View>
      )}

      {drafts.length ? (
        <Row gap={8} testID="text-unsaved">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.warning }} />
          <T variant="small" style={{ flex: 1 }}>
            {drafts.length} file{drafts.length === 1 ? " has" : "s have"} unsaved edits — save in the editor to include {drafts.length === 1 ? "it" : "them"} here.
          </T>
        </Row>
      ) : null}
      {!canPush ? <Note tone="muted" icon={ShieldAlert} title="Read-only access.">You can edit here, but can't push to this repository. Fork it on GitHub to ship changes.</Note> : null}
      {ws.changes.length ? <ShipPanel target={target} selected={selected} /> : null}
      <GitStatus key={`${branch}#${version}`} target={target} version={version} />

      <ConfirmSheet
        open={discard !== null}
        onClose={() => setDiscard(null)}
        title={discard === "all" ? `Discard all ${ws.changes.length} changes?` : "Discard changes?"}
        description={discard === "all" ? "Every file goes back to the branch, including unsaved edits. New files are removed. This can't be undone." : `${discard ?? ""} goes back to its content on the branch. This can't be undone.`}
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          if (discard === "all") ws.revertAll();
          else if (discard) ws.revert(discard);
          setDiscard(null);
        }}
      />
    </ScrollView>
  );
}
