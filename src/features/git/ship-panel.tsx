import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { AlertTriangle, GitBranchPlus, GitCommitHorizontal, GitPullRequest, RefreshCw } from "lucide-react-native";
import { useOnline } from "@/hooks/use-online";
import { AppError, describeError } from "@/lib/errors";
import { useWorkspace } from "@/features/workspace/context";
import type { FileChange } from "@/features/workspace/model";
import { githubApi } from "@/features/github/api";
import { markTasksShipped, tasksForPaths } from "@/features/agent/store";
import { branchNameError, generateCommitMessage, suggestBranchName } from "./message";
import { saveLastShip, type ShipRecord } from "./ship-store";
import { Badge, Btn, ConfirmSheet, Row, Switch, T, haptic } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/** Everything the Git tab needs to know about where changes can go. */
export interface GitTarget {
  owner: string;
  repo: string;
  /** Branch the workspace is on. */
  branch: string;
  defaultBranch: string;
  /** Known branch names (for unique working-branch names). */
  branchNames: readonly string[];
  canPush: boolean;
  /** Workspace storage key for another branch of this repo. */
  workspaceKeyFor: (branch: string) => string;
  /** Called after a successful commit; the parent switches to / reloads `branch`. */
  onShipped: (branch: string) => void;
}

type Mode = "new" | "current";
type Phase = { kind: "idle" } | { kind: "working"; step: "commit" | "pr" } | { kind: "error"; error: unknown };

export function prBody(message: string): string {
  const body = message.split("\n").slice(1).join("\n").trim();
  return `${body}\n\n---\nOpened from Chrono. Review the diff before merging.`.trim();
}

function Choice({ on, warn, onPress, disabled, children, testID }: { on: boolean; warn?: boolean; onPress: () => void; disabled?: boolean; children: ReactNode; testID: string }) {
  const { c, a } = useTheme();
  const tone = warn ? "warning" : "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled }}
      style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: on ? c[tone] : c.border, backgroundColor: on ? a(tone, 0.06) : "transparent", padding: 12, gap: 8 }}
    >
      {children}
    </Pressable>
  );
}

function Radio({ on }: { on: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? c.primary : c.mutedForeground, alignItems: "center", justifyContent: "center" }}>
      {on ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} /> : null}
    </View>
  );
}

/** Commit selected changes, push, and optionally open a PR. Working branch by default. */
export function ShipPanel({ target, selected }: { target: GitTarget; selected: FileChange[] }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const { owner, repo, branch, defaultBranch } = target;
  const onDefault = branch === defaultBranch;
  const paths = useMemo(() => selected.map((x) => x.path), [selected]);
  const tasks = useMemo(() => tasksForPaths(ws.source.storageKey, paths), [ws.source.storageKey, paths]);
  const generated = useMemo(() => generateCommitMessage(selected, { taskTitles: tasks.map((t) => t.title) }), [selected, tasks]);
  const [mode, setMode] = useState<Mode>("new");
  const [message, setMessage] = useState(generated);
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setMessage(generated);
  }, [generated]);
  const suggested = useMemo(() => suggestBranchName(tasks[0]?.title ?? generated.split("\n")[0]!, target.branchNames), [tasks, generated, target.branchNames]);
  const [branchName, setBranchName] = useState(suggested);
  const nameEdited = useRef(false);
  useEffect(() => {
    if (!nameEdited.current) setBranchName(suggested);
  }, [suggested]);

  const targetBranch = mode === "new" ? branchName.trim() : branch;
  const prBase = mode === "new" ? branch : onDefault ? null : defaultBranch;
  const [openPr, setOpenPr] = useState(true);
  const willOpenPr = !!prBase && openPr;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [confirm, setConfirm] = useState(false);
  const draftsInSelection = paths.filter((p) => p in ws.data.drafts);
  const nameErr = mode === "new" ? (branchNameError(targetBranch) ?? (target.branchNames.includes(targetBranch) ? "A branch with this name already exists." : null)) : null;
  const subject = message.split("\n")[0]!.trim();
  const online = useOnline();
  const blocked = !selected.length
    ? "Select at least one file to commit."
    : draftsInSelection.length
      ? `Save or discard unsaved edits in ${draftsInSelection.join(", ")} first.`
      : !target.canPush
        ? "You don't have push access to this repository."
        : !online
          ? "You're offline. Your changes are saved on this device — commit when you're back online."
          : (nameErr ?? (!subject ? "Write a commit message." : null));
  const working = phase.kind === "working";

  async function ship() {
    setConfirm(false);
    setPhase({ kind: "working", step: "commit" });
    const taskIds = tasks.map((t) => t.id);
    try {
      const baseSha = ws.data.baseSha;
      const res = await githubApi.commit(owner, repo, {
        branch: targetBranch,
        ...(mode === "new" ? { createFrom: baseSha } : {}),
        baseSha,
        message,
        files: selected.map((x) => ({ path: x.path, content: x.status === "deleted" ? null : (x.content ?? "") })),
        ...(mode === "current" && onDefault ? { allowDefaultBranch: true } : {}),
      });
      let pr: ShipRecord["pr"] = null;
      let prError: string | null = null;
      if (willOpenPr && prBase) {
        setPhase({ kind: "working", step: "pr" });
        try {
          const r = await githubApi.createPull(owner, repo, { head: targetBranch, base: prBase, title: subject, body: prBody(message) });
          pr = { number: r.pull.number, url: r.pull.url, existing: r.existing };
        } catch (e) {
          prError = e instanceof AppError ? e.message || describeError(e).title : "Couldn't open the pull request.";
        }
      }
      const rec: ShipRecord = { owner, repo, branch: targetBranch, from: branch, sha: res.commit.sha, url: res.commit.url, message, files: res.files, created: res.created, pr, prError, at: new Date().toISOString() };
      saveLastShip(rec);
      markTasksShipped(ws.source.storageKey, taskIds, { sha: rec.sha, url: rec.url, branch: targetBranch, at: rec.at, pr: pr ? { number: pr.number, url: pr.url } : null });
      const clean = res.parentSha === baseSha;
      ws.committed(paths, { newBaseSha: clean ? res.commit.sha : null, ...(mode === "new" ? { moveTo: target.workspaceKeyFor(targetBranch) } : {}) });
      setPhase({ kind: "idle" });
      haptic.success();
      target.onShipped(targetBranch);
    } catch (e) {
      haptic.warn();
      setPhase({ kind: "error", error: e });
    }
  }

  const errInfo = phase.kind === "error" ? describeError(phase.error) : null;
  const errMessage = phase.kind === "error" && phase.error instanceof AppError ? phase.error.message : "";
  const directDefault = mode === "current" && onDefault;

  return (
    <View testID="ship-panel" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
      <Row style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <GitCommitHorizontal size={17} color={c.primary} />
        <T variant="h3" style={{ flex: 1 }}>Commit & push</T>
        <T variant="small" testID="text-selected-count">
          {selected.length} file{selected.length === 1 ? "" : "s"}
        </T>
      </Row>
      <View style={{ padding: 14, gap: 14 }}>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Where should the commit go?">
          <T variant="label">Where should the commit go?</T>
          <Choice on={mode === "new"} onPress={() => setMode("new")} disabled={working} testID="radio-new-branch">
            <Row gap={8}>
              <Radio on={mode === "new"} />
              <GitBranchPlus size={15} color={c.foreground} />
              <T weight="medium" style={{ flex: 1 }}>New branch</T>
              <Badge label="Recommended" tone="primary" />
            </Row>
            {mode === "new" ? (
              <View style={{ gap: 6 }}>
                <TextInput
                  value={branchName}
                  onChangeText={(v) => {
                    nameEdited.current = true;
                    setBranchName(v);
                  }}
                  editable={!working}
                  accessibilityLabel="New branch name"
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  testID="input-branch-name"
                  style={{ height: 42, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: nameErr ? c.danger : c.border, backgroundColor: c.background, color: c.foreground, fontFamily: FONT.mono, fontSize: 13, paddingHorizontal: 10 }}
                />
                {nameErr ? (
                  <T variant="tiny" color="danger" testID="text-branch-error">{nameErr}</T>
                ) : (
                  <T variant="tiny">
                    From <T variant="monoSmall" color="foreground">{branch}</T> — {branch} itself stays untouched.
                  </T>
                )}
              </View>
            ) : null}
          </Choice>
          <Choice on={mode === "current"} warn={onDefault} onPress={() => setMode("current")} disabled={working} testID="radio-current-branch">
            <Row gap={8}>
              <Radio on={mode === "current"} />
              <GitCommitHorizontal size={15} color={c.foreground} />
              <T weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                Commit to <T variant="mono" color="foreground">{branch}</T>
              </T>
            </Row>
            {mode === "current" ? <T variant="tiny" color={onDefault ? "warning" : "mutedForeground"}>{onDefault ? "Directly updates the default branch. You'll be asked to confirm." : `Adds one commit on top of ${branch}. Fast-forward only — never a force-push.`}</T> : null}
          </Choice>
        </View>

        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T variant="small" weight="medium" color="foreground">Commit message</T>
            <Btn
              label="Regenerate"
              icon={RefreshCw}
              variant="ghost"
              size="sm"
              disabled={working || message === generated}
              onPress={() => {
                edited.current = false;
                setMessage(generated);
              }}
              testID="button-regenerate-message"
            />
          </Row>
          <TextInput
            value={message}
            onChangeText={(v) => {
              edited.current = true;
              setMessage(v);
            }}
            editable={!working}
            multiline
            textAlignVertical="top"
            testID="input-commit-message"
            style={{ minHeight: 120, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, color: c.foreground, fontFamily: FONT.mono, fontSize: 13, lineHeight: 19, padding: 10 }}
          />
          <T variant="tiny">Generated from the selected changes{tasks.length ? " and the AI task that made them" : ""}. Edit freely.</T>
        </View>

        {prBase ? (
          <Row gap={8} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 10 }}>
            <GitPullRequest size={15} color={c.mutedForeground} />
            <T variant="small" color="foreground" style={{ flex: 1 }}>
              Open a pull request into <T variant="monoSmall" color="foreground">{prBase}</T>
            </T>
            <Switch value={openPr} onValueChange={setOpenPr} label="Open a pull request" disabled={working} />
          </Row>
        ) : null}

        {phase.kind === "error" && errInfo ? (
          <View accessibilityRole="alert" testID="ship-error" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: a("danger", 0.4), backgroundColor: a("danger", 0.07), padding: 12, gap: 6 }}>
            <Row gap={6}>
              <AlertTriangle size={15} color={c.danger} />
              <T weight="semibold" color="danger" style={{ flex: 1 }}>{errInfo.title}</T>
            </Row>
            {errMessage ? <T variant="small" color="foreground">{errMessage}</T> : null}
            <T variant="small">{errInfo.hint}</T>
            {errInfo.code === "GIT_CONFLICT" || errInfo.code === "BRANCH_PROTECTED" ? (
              <Btn label="Use a new branch instead" icon={GitBranchPlus} variant="secondary" size="sm" onPress={() => { setMode("new"); setPhase({ kind: "idle" }); }} testID="button-use-new-branch" />
            ) : errInfo.code === "BRANCH_EXISTS" ? (
              <Btn
                label="Pick another name"
                variant="secondary"
                size="sm"
                onPress={() => {
                  nameEdited.current = true;
                  setBranchName(suggestBranchName(targetBranch, [...target.branchNames, targetBranch]));
                  setPhase({ kind: "idle" });
                }}
              />
            ) : null}
          </View>
        ) : null}

        <View testID="ship-action-bar" style={{ gap: 8 }}>
          {blocked && selected.length ? <T variant="small" color="warning" testID="text-ship-blocked">{blocked}</T> : null}
          <Btn
            label={working ? (phase.step === "pr" ? "Opening pull request…" : "Committing & pushing…") : `Commit & push ${selected.length} file${selected.length === 1 ? "" : "s"}`}
            loading={working}
            disabled={!!blocked || working}
            onPress={() => setConfirm(true)}
            size="lg"
            testID="button-commit"
          />
        </View>
      </View>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={directDefault ? `Commit directly to ${branch}?` : "Commit and push?"}
        confirmLabel={directDefault ? `Commit to ${branch}` : "Commit & push"}
        danger={directDefault}
        onConfirm={() => void ship()}
        description={
          <View style={{ gap: 10 }} testID="ship-summary">
            {directDefault ? <T variant="small" color="warning">{`This updates ${branch}, the default branch, without a pull request. A new branch is safer.`}</T> : null}
            <SummaryRow label="Branch">
              <T variant="mono" color="foreground">{targetBranch}</T>
              {mode === "new" ? <T variant="small"> (new, from {branch})</T> : null}
            </SummaryRow>
            <SummaryRow label="Files">
              <T variant="small" color="foreground">
                {selected.length} — {selected.slice(0, 4).map((x) => x.path.slice(x.path.lastIndexOf("/") + 1)).join(", ")}
                {selected.length > 4 ? ` +${selected.length - 4}` : ""}
              </T>
            </SummaryRow>
            <SummaryRow label="Message">
              <T variant="small" color="foreground">{subject}</T>
            </SummaryRow>
            {willOpenPr ? (
              <SummaryRow label="PR">
                <T variant="monoSmall" color="foreground">
                  {targetBranch} → {prBase}
                </T>
              </SummaryRow>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row center={false} gap={10}>
      <T variant="small" style={{ width: 64 }}>{label}</T>
      <T style={{ flex: 1 }}>{children}</T>
    </Row>
  );
}
