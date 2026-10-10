import { useMemo, type ReactNode } from "react";
import { Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, GitBranch, History, MonitorSmartphone, RefreshCw, XCircle } from "lucide-react-native";
import { useWorkspace } from "@/features/workspace/context";
import { diffChange } from "@/features/git/diff";
import { GitStatus } from "@/features/git/git-status";
import type { GitTarget } from "@/features/git/ship-panel";
import { ActiveProviderLink } from "@/features/ai/active-provider";
import { recentAgentTasks } from "@/features/agent/store";
import { HISTORY_STATUS_LABEL, toHistoryEntry } from "@/features/history/history";
import { STATUS_TONE } from "@/features/history/task-detail";
import { loadPreviewStatus } from "@/features/preview/status";
import { useOnline } from "@/hooks/use-online";
import type { WorkspaceTab } from "@/lib/nav";
import { PROJECT_KIND_LABEL, detectProjectKindFromPaths } from "@/lib/tree";
import { timeAgo } from "@/lib/utils";
import type { ProjectRef } from "@/types/workspace";
import { Badge, Btn, Card as KitCard, Row, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

function Card({ title, action, children, testID }: { title: string; action?: ReactNode; children: ReactNode; testID: string }) {
  return (
    <KitCard testID={testID} style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between", minHeight: 28 }}>
        <T variant="label">{title}</T>
        {action}
      </Row>
      {children}
    </KitCard>
  );
}

function Dl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Row gap={12}>
      <T variant="small" style={{ width: 76 }}>{label}</T>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>{children}</View>
    </Row>
  );
}

function LinkText({ label, onPress, icon: Icon, testID }: { label: string; onPress: () => void; icon?: typeof ArrowRight; testID?: string }) {
  const { c } = useTheme();
  return (
    <Row gap={4}>
      <T variant="small" color="primary" weight="semibold" onPress={onPress} testID={testID}>{label}</T>
      {Icon ? <Icon size={13} color={c.primary} /> : null}
    </Row>
  );
}

/**
 * Project dashboard: repository, current branch, last sync, AI provider/model, recent tasks,
 * recent commits, preview status and Git status — one screen per repository.
 */
export function ProjectDashboard({ project, target, syncedAt, refreshing = false, onRefresh, onPickBranch, onTab }: { project: ProjectRef; target: GitTarget; syncedAt: string | null; refreshing?: boolean; onRefresh?: () => void; onPickBranch?: () => void; onTab: (t: WorkspaceTab) => void }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const online = useOnline();
  const kind = detectProjectKindFromPaths(ws.paths);
  const totals = useMemo(() => ws.changes.reduce((t, ch) => { const d = diffChange(ch); return { a: t.a + d.added, r: t.r + d.removed }; }, { a: 0, r: 0 }), [ws.changes]);
  const drafts = Object.keys(ws.data.drafts).length;
  const tasks = useMemo(() => recentAgentTasks(Infinity).filter((t) => t.owner === project.owner && t.repo === project.name).slice(0, 3).map(toHistoryEntry), [project.owner, project.name]);
  const preview = loadPreviewStatus(ws.source.storageKey);
  const repoUrl = `https://github.com/${project.owner}/${project.name}`;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }} testID="project-dashboard">
      <Card title="Repository" testID="card-repository" action={<LinkText label="GitHub" icon={ExternalLink} onPress={() => void Linking.openURL(repoUrl)} />}>
        <T variant="mono" color="foreground" style={{ fontSize: 15 }}>
          {project.owner}/{project.name}
        </T>
        {project.description ? <T variant="small">{project.description}</T> : null}
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          <Badge label={project.visibility} />
          <Badge label={PROJECT_KIND_LABEL[kind]} />
          <Badge label={`${ws.paths.length} file${ws.paths.length === 1 ? "" : "s"}`} />
          {ws.source.truncated ? <Badge label="Partial tree" tone="warning" /> : null}
        </Row>
      </Card>

      <Card title="Branch & sync" testID="card-branch" action={onRefresh ? <Btn label="Sync" icon={RefreshCw} variant="ghost" size="sm" loading={refreshing} disabled={!online} onPress={onRefresh} testID="button-refresh-tree" /> : null}>
        <View style={{ gap: 8 }}>
          <Dl label="Current">
            {onPickBranch ? (
              <Row gap={4} style={{ flexShrink: 1 }}>
                <GitBranch size={13} color={c.primary} />
                <T variant="mono" color="primary" numberOfLines={1} onPress={onPickBranch} testID="button-dashboard-branch" style={{ flexShrink: 1 }}>{target.branch}</T>
              </Row>
            ) : (
              <T variant="mono">{target.branch}</T>
            )}
            {target.branch === target.defaultBranch ? <T variant="tiny">(default)</T> : null}
          </Dl>
          <Dl label="Commit"><T variant="mono">{ws.source.commitSha.slice(0, 7)}</T></Dl>
          <Dl label="Last sync"><T variant="small" color="foreground" testID="text-last-sync">{syncedAt ? timeAgo(new Date(syncedAt)) : "Not synced yet"}</T></Dl>
        </View>
        {ws.baseMoved ? (
          <Row center={false} gap={8} style={{ borderRadius: RADIUS.md, backgroundColor: a("warning", 0.1), padding: 10 }}>
            <AlertTriangle size={15} color={c.warning} style={{ marginTop: 2 }} />
            <T variant="small" color="warning" style={{ flex: 1 }}>The branch moved on GitHub since your changes were made. Commit them to a new branch to stay safe.</T>
          </Row>
        ) : null}
      </Card>

      <Card title="Git status" testID="card-git-status" action={<LinkText label={ws.changes.length ? "Review & commit" : "Open Git"} icon={ArrowRight} onPress={() => onTab("git")} testID="link-dashboard-git" />}>
        <View testID="text-git-summary" style={{ gap: 2 }}>
          {ws.changes.length ? (
            <T variant="small" color="foreground">
              <T variant="small" color="foreground" weight="semibold">{ws.changes.length} changed file{ws.changes.length === 1 ? "" : "s"}</T>{" "}
              <T variant="monoSmall" style={{ color: c.diffAdd }}>+{totals.a}</T> <T variant="monoSmall" style={{ color: c.diffDel }}>-{totals.r}</T>
              <T variant="small"> · not committed yet</T>
            </T>
          ) : (
            <T variant="small">Working tree clean.</T>
          )}
          {drafts ? <T variant="tiny">{drafts} unsaved editor draft{drafts === 1 ? "" : "s"} (kept on this device)</T> : null}
        </View>
        <GitStatus target={target} version={0} compact />
      </Card>

      <Card title="AI" testID="card-ai">
        <ActiveProviderLink />
        <Row style={{ justifyContent: "space-between", marginTop: 4 }}>
          <T variant="h3" style={{ fontSize: 13 }}>Recent tasks</T>
          <Row gap={4}>
            <History size={13} color={c.primary} />
            <T variant="small" color="primary" weight="semibold" onPress={() => router.push({ pathname: "/history", params: { repo: `${project.owner}/${project.name}` } })} testID="link-dashboard-history">History</T>
          </Row>
        </Row>
        {tasks.length ? (
          <View testID="list-dashboard-tasks" style={{ gap: 6 }}>
            {tasks.map((t) => (
              <Row key={t.ref.task.id} gap={8}>
                <T variant="small" color="foreground" numberOfLines={1} style={{ flex: 1 }}>{t.ref.task.title}</T>
                <Badge label={HISTORY_STATUS_LABEL[t.status]} tone={STATUS_TONE[t.status]} />
              </Row>
            ))}
          </View>
        ) : (
          <T variant="small">
            No tasks yet. <T variant="small" color="primary" onPress={() => onTab("ai")}>Ask the agent</T>
          </T>
        )}
      </Card>

      <Card title="Preview" testID="card-preview" action={<LinkText label="Open" icon={MonitorSmartphone} onPress={() => onTab("preview")} />}>
        {preview ? (
          <Row center={false} gap={8} testID="text-preview-status">
            {preview.status === "ready" && preview.runtimeErrors === 0 ? (
              <CheckCircle2 size={16} color={c.success} />
            ) : preview.status === "ready" ? (
              <AlertTriangle size={16} color={c.warning} />
            ) : (
              <XCircle size={16} color={c.danger} />
            )}
            <View style={{ flex: 1 }}>
              <T variant="small" color="foreground" weight="medium">
                {preview.status === "ready" ? (preview.runtimeErrors ? `Built · ${preview.runtimeErrors} runtime error${preview.runtimeErrors === 1 ? "" : "s"}` : "Built and running") : preview.status === "error" ? "Build failed" : "Not previewable in the app"}
                <T variant="small"> · {preview.label} · {timeAgo(new Date(preview.at))}</T>
              </T>
              {preview.message ? <T variant="tiny" numberOfLines={3}>{preview.message}</T> : null}
            </View>
          </Row>
        ) : (
          <T variant="small">Not run yet on this branch.</T>
        )}
      </Card>
    </ScrollView>
  );
}
