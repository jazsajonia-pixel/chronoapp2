import { Code2, FolderGit2, GitBranch, Home, LayoutDashboard, MonitorSmartphone, Settings, Sparkles, WandSparkles, type LucideIcon } from "lucide-react-native";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Pages for the command palette. The app drawer has its own list (features/shell/app-drawer.tsx). */
export const MAIN_NAV: NavItem[] = [
  { label: "Home", href: "/home", icon: Home },
  { label: "Projects", href: "/projects", icon: FolderGit2 },
  { label: "Chats", href: "/ai", icon: Sparkles },
  { label: "Skills", href: "/skills", icon: WandSparkles },
  { label: "Preview", href: "/preview", icon: MonitorSmartphone },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Tabs in the workspace tab strip (under the workspace top bar). */
export const WORKSPACE_NAV_TABS = ["overview", "files", "ai", "preview", "git"] as const;
export const WORKSPACE_TABS = WORKSPACE_NAV_TABS;
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

export const WORKSPACE_TAB_META: Record<WorkspaceTab, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: LayoutDashboard },
  files: { label: "Files", icon: Code2 },
  ai: { label: "AI", icon: Sparkles },
  preview: { label: "Preview", icon: MonitorSmartphone },
  git: { label: "Git", icon: GitBranch },
};

export function isWorkspaceTab(value: string | undefined): value is WorkspaceTab {
  return !!value && (WORKSPACE_TABS as readonly string[]).includes(value);
}

/** Route to a project workspace (optionally a tab). */
export function projectPath(owner: string, repo: string, tab?: WorkspaceTab): string {
  const base = `/project/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

/**
 * Route to a project's AI chat. `task` selects a saved chat by id, or "new" to start a fresh one;
 * `branch` opens the branch the chat was saved on.
 */
export function chatPath(owner: string, repo: string, opts: { branch?: string; task?: string } = {}): string {
  let href = projectPath(owner, repo, "ai");
  if (opts.branch) href += `&branch=${encodeURIComponent(opts.branch)}`;
  if (opts.task) href += `&task=${encodeURIComponent(opts.task === "new" ? `new-${Date.now()}` : opts.task)}`;
  return href;
}
