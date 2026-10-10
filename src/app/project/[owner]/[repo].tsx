import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, ExternalLink, FolderGit2, GitBranch, Lock, Play, Search } from "lucide-react-native";
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
import { Badge, Btn, EmptyState, ErrorState, Header, IconBtn, Row, Skeleton, T, haptic } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

function toProjectRef(repo: RepoSummary): ProjectRef {
  return { id: `github/${repo.fullName}`, source: "github", owner: repo.owner, name: repo.name, defaultBranch: repo.defaultBranch, visibility: repo.private ? "private" : "public", description: repo.description ?? undefined };
}

/** Publishes this workspace's files to the command palette while it's open. */
function PaletteFiles({ name, branch, goFiles }: { name: string; branch: string; goFiles: () => void }) {
  const ws = useWorkspace();
  const openRef = useRef(ws.openFile);
  openRef.current = ws.openFile;
  const goRef = useRef(goFiles);
  goRef.current = goFiles;
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
    <View style={{ paddingTop: insets.top, backgroundColor: c.background, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Row style={{ minHeight: 54, paddingHorizontal: 4 }} gap={2}>
        <IconBtn icon={ChevronLeft} label="Back to projects" onPress={() => (router.canGoBack() ? router.back() : router.replace("/projects"))} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="h3" numberOfLines={1} testID="text-repo-name">
            <T variant="small" style={{ fontSize: 14 }}>{project.owner}/</T>
            {project.name}
          </T>
          {onBranch ? (
            <Pressable onPress={onBranch} hitSlop={6} testID="button-branch" style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 1 }}>
              <GitBranch size={12} color={c.mutedForeground} />
              <T variant="monoSmall" numberOfLines={1} style={{ maxWidth: 200 }} testID="text-branch">{branch}</T>
              <ChevronDown size={12} color={c.mutedForeground} />
            </Pressable>
          ) : (
            <Row gap={4}>
              <GitBranch size={12} color={c.mutedForeground} />
              <T variant="monoSmall" testID="text-branch">{branch}</T>
            </Row>
          )}
        </View>
        {project.visibility === "private" ? <Badge label="Private" icon={Lock} /> : null}
        <IconBtn icon={Search} label="Search files and commands" onPress={openCommandPalette} testID="button-workspace-search" />
        {onPreview ? <IconBtn icon={Play} label="Preview" onPress={onPreview} testID="button-header-preview" color="primary" /> : null}
      </Row>
    </View>
  );
}

function useKeyboardVisible(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

function WorkspaceTabBar({ tab, onTab, badge }: { tab: WorkspaceTab; onTab: (t: WorkspaceTab) => void; badge: number }) {
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  // Typing gets the whole screen above the keyboard (the website hides its tab bar the same way).
  const keyboard = useKeyboardVisible();
  if (keyboard) return null;
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.sidebar, paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
      {WORKSPACE_TABS.map((t) => {
        const meta = WORKSPACE_TAB_META[t];
        const on = t === tab;
        const Icon = meta.icon;
        return (
          <Pressable
            key={t}
            testID={`tab-${t}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={meta.label}
            onPress={() => {
              haptic.tap();
              onTab(t);
            }}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
          >
            <View style={{ paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999, backgroundColor: on ? a("primary", 0.14) : "transparent" }}>
              <Icon size={20} color={on ? c.primary : c.mutedForeground} />
              {t === "git" && badge > 0 ? (
                <View testID="badge-changes" style={{ position: "absolute", top: -2, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                  <Text style={{ color: c.primaryForeground, fontSize: 10, fontFamily: FONT.bold }}>{badge > 99 ? "99+" : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 11, fontFamily: on ? FONT.semibold : FONT.medium, color: on ? c.foreground : c.mutedForeground }}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function GitBadgeBar(props: { tab: WorkspaceTab; onTab: (t: WorkspaceTab) => void }) {
  const ws = useOptionalWorkspace();
  return <WorkspaceTabBar {...props} badge={ws ? ws.changes.length : 0} />;
}

function GitHubWorkspace({ owner, name, initialTab }: { owner: string; name: string; initialTab: WorkspaceTab }) {
  const { c } = useTheme();
  const [tab, setTabState] = useState<WorkspaceTab>(initialTab);
  // Tabs stay mounted once visited (editor history, agent chat and preview survive tab switches).
  const [visited, setVisited] = useState<ReadonlySet<WorkspaceTab>>(() => new Set([initialTab]));
  const setTab = (t: WorkspaceTab) => {
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
    router.setParams({ tab: t });
  };
  const params = useLocalSearchParams<{ tab?: string }>();
  useEffect(() => {
    if (isWorkspaceTab(params.tab) && params.tab !== tab) {
      setTabState(params.tab);
      setVisited((v) => new Set(v).add(params.tab as WorkspaceTab));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);

  const repo = useAsync(() => githubApi.repo(owner, name), [owner, name]);
  const branches = useAsync(() => githubApi.branches(owner, name), [owner, name]);
  const [branch, setBranch] = useState<string | null>(() => lastBranch(owner, name));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [created, setCreated] = useState<ReadonlySet<string>>(() => new Set());
  const [gitVersion, setGitVersion] = useState(0);

  useEffect(() => {
    if (repo.status !== "success") return;
    if (!branch) setBranch(repo.data.defaultBranch);
    else if (branches.status === "success" && !created.has(branch) && !branches.data.branches.some((b) => b.name === branch) && !branches.data.truncated) setBranch(repo.data.defaultBranch);
  }, [repo, branches, branch, created]);
  useEffect(() => {
    if (branch && repo.status === "success") rememberRepo(owner, name, branch);
  }, [owner, name, branch, repo.status]);

  const tree = useAsync(() => (branch ? githubApi.tree(owner, name, branch) : new Promise<never>(() => {})), [owner, name, branch]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  useEffect(() => {
    if (tree.status === "success") setSyncedAt(new Date().toISOString());
  }, [tree.status, tree.data]);

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

  const shell = (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.background }}>
      <WorkspaceHeader project={project} branch={shownBranch} onBranch={repo.status === "success" ? () => setPickerOpen(true) : undefined} onPreview={tab !== "preview" && source ? () => setTab("preview") : undefined} />
      <View style={{ flex: 1 }}>
        {body}
      </View>
      {repo.status === "success" && (tab === "git" || !source) ? (
        <Pressable onPress={() => void Linking.openURL(`https://github.com/${owner}/${name}`)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}>
          <ExternalLink size={13} color={c.mutedForeground} />
          <T variant="tiny">Open on GitHub</T>
        </Pressable>
      ) : null}
      <GitBadgeBar tab={tab} onTab={setTab} />
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
