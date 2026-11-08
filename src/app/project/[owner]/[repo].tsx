import { useLayoutEffect, useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardCompact, useKeyboardVisible } from "@/hooks/use-keyboard-visible";
import { ChevronDown, FolderGit2, GitBranch, Lock, Menu, Play, Search } from "lucide-react-native";
import { openDrawer } from "@/features/shell/drawer-store";
import { FilesTab } from "@/features/editor/files-tab";
import { ChangesPanel } from "@/features/git/changes-panel";
import type { GitTarget } from "@/features/git/ship-panel";
import { ProjectDashboard } from "@/features/dashboard/project-dashboard";
import { AgentPanel } from "@/features/agent/agent-panel";
import { PreviewPanel } from "@/features/preview/preview-panel";
import { WorkspaceProvider, useOptionalWorkspace, useWorkspace, type WorkspaceSource } from "@/features/workspace/context";
import { workspaceKey } from "@/features/workspace/persist";
import { BranchPicker } from "@/features/github/branch-picker";
import { githubApi } from "@/features/github/api";
import { lastBranch, rememberRepo } from "@/features/github/recent";
import { registerPaletteFiles, openCommandPalette } from "@/features/command/palette-store";
import { useAsync } from "@/hooks/use-async";
import { useSession } from "@/stores/session";
import { WORKSPACE_TABS, WORKSPACE_TAB_META, isWorkspaceTab, type WorkspaceTab } from "@/lib/nav";
import { describeError } from "@/lib/errors";
import type { ProjectRef } from "@/types/workspace";
import type { RepoSummary } from "@/types/github";
import { Btn, EmptyState, ErrorState, Header, IconBtn, Row, Skeleton, T, haptic } from "@/ui/kit";
import { FONT, useTheme } from "@/ui/theme";

function toProjectRef(repo: RepoSummary): ProjectRef {
  return { id: `github/${repo.fullName}`, source: "github", owner: repo.owner, name: repo.name, defaultBranch: repo.defaultBranch, visibility: repo.private ? "private" : "public", description: repo.description ?? undefined };
}

/** Publishes this workspace's files to the command palette while it's open. */
function PaletteFiles({ name, branch, goFiles }: { name: string; branch: string; goFiles: () => void }) {
  const ws = useWorkspace();
  const openRef = useRef(ws.openFile);
  useLayoutEffect(() => {
    openRef.current = ws.openFile;
  });
  const goRef = useRef(goFiles);
  useLayoutEffect(() => {
    goRef.current = goFiles;
  });
  useEffect(
    () =>
      registerPaletteFiles({
        label: `${name}@${branch}`,
        paths: ws.paths,
        open: (path) => {
          openRef.current(path);
          goRef.current();
        },
      }),
    [name, branch, ws.paths],
  );
  return null;
}

/** Git → "edit this file" jumps to the Files tab with the file open. */
function EditFromGit({ children, goFiles }: { children: (onEdit: (path: string) => void) => ReactNode; goFiles: () => void }) {
  const ws = useWorkspace();
  return (
    <>
      {children((path) => {
        ws.openFile(path);
        goFiles();
      })}
    </>
  );
}

function WorkspaceHeader({ project, branch, onBranch, onPreview }: { project: ProjectRef; branch: string; onBranch?: () => void; onPreview?: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: c.background }}>
      <Row style={{ minHeight: 56, paddingHorizontal: 4 }} gap={2}>
        <IconBtn icon={Menu} label="Open menu" size={48} onPress={openDrawer} testID="button-open-menu" />
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
          <T numberOfLines={1} testID="text-repo-name" style={{ fontSize: 16, lineHeight: 21, fontFamily: FONT.semibold }}>
            {project.name}
          </T>
          {onBranch ? (
            <Pressable onPress={onBranch} hitSlop={8} testID="button-branch" accessibilityRole="button" accessibilityLabel={`Branch ${branch}. Change branch`} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 22 }}>
              <T variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{project.owner}</T>
              <T variant="small">·</T>
              <GitBranch size={12} color={c.mutedForeground} />
              <T variant="monoSmall" numberOfLines={1} style={{ maxWidth: 160, fontSize: 12 }} testID="text-branch">{branch}</T>
              <ChevronDown size={13} color={c.mutedForeground} />
            </Pressable>
          ) : (
            <Row gap={4} style={{ minHeight: 22 }}>
              <T variant="small" numberOfLines={1}>{project.owner}</T>
              <T variant="small">·</T>
              <T variant="monoSmall" testID="text-branch" style={{ fontSize: 12 }}>{branch}</T>
            </Row>
          )}
        </View>
        {project.visibility === "private" ? <Lock size={14} color={c.mutedForeground} accessibilityLabel="Private repository" /> : null}
        <IconBtn icon={Search} label="Search files and commands" size={44} onPress={openCommandPalette} testID="button-workspace-search" />
        {onPreview ? <IconBtn icon={Play} label="Preview" size={44} onPress={onPreview} testID="button-header-preview" color="primary" /> : null}
      </Row>
    </View>
  );
}

/** Workspace sections as a text tab strip under the top bar (no bottom bar: the chat composer and editor own the bottom edge). */
function WorkspaceTabs({ tab, onTab, badge }: { tab: WorkspaceTab; onTab: (t: WorkspaceTab) => void; badge: number }) {
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // Tabs share the width when they fit and scroll sideways instead of truncating on narrow
    // screens / large font scales.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left + 4, paddingRight: insets.right + 4 }}
    >
      {WORKSPACE_TABS.map((t) => {
        const meta = WORKSPACE_TAB_META[t];
        const on = t === tab;
        return (
          <Pressable
            key={t}
            testID={`tab-${t}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t === "git" && badge > 0 ? `${meta.label}, ${badge} changed` : meta.label}
            onPress={() => {
              haptic.tap();
              onTab(t);
            }}
            android_ripple={{ color: a("foreground", 0.08), borderless: false }}
            style={{ flexGrow: 1, minHeight: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ fontSize: 14, fontFamily: on ? FONT.semibold : FONT.medium, color: on ? c.foreground : c.mutedForeground }}>{meta.label}</Text>
              {t === "git" && badge > 0 ? (
                <View testID="badge-changes" style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Text maxFontSizeMultiplier={1.2} style={{ color: c.primaryForeground, fontSize: 11, fontFamily: FONT.semibold }}>{badge > 99 ? "99+" : badge}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ position: "absolute", left: 10, right: 10, bottom: -1, height: 2, borderRadius: 1, backgroundColor: on ? c.primary : "transparent" }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Gesture-bar clearance under the panes; the keyboard covers that area while it's open. */
function BottomInset() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  return keyboard ? null : <View style={{ height: insets.bottom }} />;
}

function TopInset() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top }} />;
}

/** Keeps pane content clear of side cutouts/gesture edges in landscape, with a little extra room on wide screens. */
function Panes({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const extra = width >= 700 ? 12 : 0;
  return <View style={{ flex: 1, paddingLeft: insets.left + extra, paddingRight: insets.right + extra }}>{children}</View>;
}

function GitBadgeTabs(props: { tab: WorkspaceTab; onTab: (t: WorkspaceTab) => void }) {
  const ws = useOptionalWorkspace();
  return <WorkspaceTabs {...props} badge={ws ? ws.changes.length : 0} />;
}

function GitHubWorkspace({ owner, name, initialTab }: { owner: string; name: string; initialTab: WorkspaceTab }) {
  const { c } = useTheme();
  const compact = useKeyboardCompact();
  const [tab, setTabState] = useState<WorkspaceTab>(initialTab);
  // Tabs stay mounted once visited (editor history, agent chat and preview survive tab switches).
  const [visited, setVisited] = useState<ReadonlySet<WorkspaceTab>>(() => new Set([initialTab]));
  const setTab = (t: WorkspaceTab) => {
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    router.setParams({ tab: t });
  };
  const params = useLocalSearchParams<{ tab?: string; branch?: string }>();
  // Follow tab changes that arrive through the route (drawer links, deep links).
  const [seenTabParam, setSeenTabParam] = useState(params.tab);
  if (seenTabParam !== params.tab) {
    setSeenTabParam(params.tab);
    if (isWorkspaceTab(params.tab) && params.tab !== tab) {
      setTabState(params.tab);
      setVisited((v) => new Set(v).add(params.tab as WorkspaceTab));
    }
  }

  const repo = useAsync(() => githubApi.repo(owner, name), [owner, name]);
  const branches = useAsync(() => githubApi.branches(owner, name), [owner, name]);
  const [branch, setBranch] = useState<string | null>(() => (typeof params.branch === "string" && params.branch ? params.branch : lastBranch(owner, name)));
  // A chat link (drawer / Chats) can carry its branch; follow it if this workspace is already open.
  const [seenBranchParam, setSeenBranchParam] = useState(params.branch);
  if (seenBranchParam !== params.branch) {
    setSeenBranchParam(params.branch);
    if (typeof params.branch === "string" && params.branch) setBranch(params.branch);
  }
  const [pickerOpen, setPickerOpen] = useState(false);
  const [created, setCreated] = useState<ReadonlySet<string>>(() => new Set());
  const [gitVersion, setGitVersion] = useState(0);

  // No branch yet, or one that no longer exists: fall back to the default branch.
  if (repo.status === "success" && branch !== repo.data.defaultBranch) {
    const missing = !branch || (branches.status === "success" && !created.has(branch) && !branches.data.branches.some((b) => b.name === branch) && !branches.data.truncated);
    if (missing) setBranch(repo.data.defaultBranch);
  }
  useEffect(() => {
    if (branch && repo.status === "success") rememberRepo(owner, name, branch);
  }, [owner, name, branch, repo.status]);

  const tree = useAsync(() => (branch ? githubApi.tree(owner, name, branch) : new Promise<never>(() => {})), [owner, name, branch]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncedTree, setSyncedTree] = useState<unknown>(null);
  if (tree.status === "success" && tree.data !== syncedTree) {
    setSyncedTree(tree.data);
    setSyncedAt(new Date().toISOString());
  }

  const source = useMemo<WorkspaceSource | null>(() => {
    if (tree.status !== "success" || !branch) return null;
    const blobs = tree.data.entries.filter((e) => e.type === "blob");
    return {
      storageKey: workspaceKey("github", owner, name, branch),
      commitSha: tree.data.commitSha,
      basePaths: blobs.map((e) => e.path),
      baseSizes: new Map(blobs.map((e) => [e.path, e.size ?? 0])),
      truncated: tree.data.truncated,
      loadBase: async (path) => (await githubApi.file(owner, name, tree.data.commitSha, path)).content,
      githubUrl: (p) => `https://github.com/${owner}/${name}/blob/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`,
    };
  }, [tree, owner, name, branch]);

  const placeholder: ProjectRef = { id: `github/${owner}/${name}`, source: "github", owner, name, defaultBranch: "…", visibility: "public" };
  const project = repo.status === "success" ? toProjectRef(repo.data) : placeholder;
  const shownBranch = branch ?? (repo.status === "success" ? repo.data.defaultBranch : "…");
  const gitTarget: GitTarget = {
    owner,
    repo: name,
    branch: shownBranch,
    defaultBranch: repo.status === "success" ? repo.data.defaultBranch : shownBranch,
    branchNames: [...(branches.status === "success" ? branches.data.branches.map((b) => b.name) : []), ...created],
    canPush: repo.status === "success" ? repo.data.permissions.push && !repo.data.archived : false,
    workspaceKeyFor: (b) => workspaceKey("github", owner, name, b),
    onShipped: (b) => {
      setGitVersion((v) => v + 1);
      if (b !== shownBranch) {
        setCreated((s) => new Set(s).add(b));
        setBranch(b);
        branches.retry();
      } else {
        tree.retry();
      }
    },
  };
  const goFiles = () => setTab("files");
  const pub = repo.status === "success" && !repo.data.private;
  const sha = tree.status === "success" ? tree.data.commitSha : null;

  const treeFailed = repo.status !== "error" && tree.status === "error";
  const loading = (
    <View style={{ padding: 16, gap: 10 }} accessibilityLabel="Loading files">
      <Skeleton height={20} width="40%" />
      {[45, 60, 35, 70, 50, 40, 65].map((w, i) => (
        <Skeleton key={i} height={14} width={`${w}%`} />
      ))}
    </View>
  );

  const pane = (t: WorkspaceTab): ReactNode => {
    if (treeFailed) {
      return describeError(tree.error).code === "EMPTY_REPOSITORY" ? (
        <EmptyState icon={FolderGit2} title="This repository is empty">Push a first commit on GitHub, then come back.</EmptyState>
      ) : (
        <View style={{ padding: 16 }}>
          <ErrorState error={tree.error} onRetry={tree.retry} />
        </View>
      );
    }
    if (!source || repo.status !== "success") return loading;
    // The dashboard reads the workspace, which only exists once the tree has loaded.
    if (t === "overview") {
      return (
        <ProjectDashboard
          project={project}
          target={gitTarget}
          syncedAt={syncedAt}
          onRefresh={() => {
            tree.retry();
            branches.retry();
          }}
          onPickBranch={() => setPickerOpen(true)}
          onTab={setTab}
        />
      );
    }
    if (t === "files") return <FilesTab onGit={() => setTab("git")} />;
    if (t === "ai") return <AgentPanel project={{ owner: project.owner, repo: project.name, branch: shownBranch, source: "github" }} active={tab === "ai"} onTab={setTab} />;
    if (t === "preview") return <PreviewPanel owner={owner} repo={name} active={tab === "preview"} onTab={setTab} assetUrl={pub && sha ? (p: string) => `https://raw.githubusercontent.com/${owner}/${name}/${sha}/${p.split("/").map(encodeURIComponent).join("/")}` : undefined} />;
    return (
      <EditFromGit goFiles={goFiles}>
        {(onEdit) => (
          <View style={{ flex: 1 }}>
            <ChangesPanel version={gitVersion} onEdit={onEdit} target={gitTarget} />
          </View>
        )}
      </EditFromGit>
    );
  };

  let body: ReactNode;
  if (repo.status === "error") {
    body = (
      <View style={{ padding: 16, gap: 12 }}>
        <ErrorState error={repo.error} onRetry={repo.retry} />
        <Btn label="Back to projects" variant="secondary" onPress={() => router.replace("/projects")} />
      </View>
    );
  } else {
    body = WORKSPACE_TABS.filter((t) => visited.has(t) || t === tab).map((t) => (
      <View key={t} style={t === tab ? { flex: 1 } : { display: "none" }}>
        {pane(t)}
      </View>
    ));
  }

  // Android is edge-to-edge, so the window no longer resizes for the keyboard: "padding" lifts the
  // composer/editor toolbar above it on both platforms. Bottom safe-area padding lives in each pane.
  // Landscape phones: with the keyboard up there is ~140dp left, so the header + tabs step aside
  // and the composer/editor bar stays visible above the keyboard.
  const shell = (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      {compact ? <TopInset /> : (
        <>
          <WorkspaceHeader project={project} branch={shownBranch} onBranch={repo.status === "success" ? () => setPickerOpen(true) : undefined} onPreview={tab !== "preview" && source ? () => setTab("preview") : undefined} />
          <GitBadgeTabs tab={tab} onTab={setTab} />
        </>
      )}
      <Panes>{body}</Panes>
      <BottomInset />
      {source ? <PaletteFiles name={name} branch={shownBranch} goFiles={goFiles} /> : null}
      {repo.status === "success" ? (
        <BranchPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          branches={branches}
          current={shownBranch}
          defaultBranch={repo.data.defaultBranch}
          onRetry={branches.retry}
          onSelect={(b) => {
            setBranch(b);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );

  // Keyed by branch + commit: switching branches swaps to that branch's own saved workspace.
  return source ? (
    <WorkspaceProvider key={`${source.storageKey}#${source.commitSha}`} source={source}>
      {shell}
    </WorkspaceProvider>
  ) : (
    shell
  );
}

export default function WorkspaceScreen() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ owner: string; repo: string; tab?: string }>();
  const owner = decodeURIComponent(params.owner ?? "");
  const repo = decodeURIComponent(params.repo ?? "");
  const tab: WorkspaceTab = isWorkspaceTab(params.tab) ? params.tab : "files";
  if (session.mode !== "github") {
    return (
      <>
        <Header title={`${owner}/${repo}`} back />
        <EmptyState icon={FolderGit2} title="Sign in with GitHub to open this repository" action={<Btn label="Sign in" onPress={() => router.push("/signin")} />} />
      </>
    );
  }
  return <GitHubWorkspace key={`${owner}/${repo}`} owner={owner} name={repo} initialTab={tab} />;
}

// A crash here stays on this screen (Try again / Go home) instead of taking down the app.
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/error-boundary";
