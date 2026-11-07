import { useCallback, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowUp, Bot, FolderGit2, MessageSquareText, MonitorSmartphone, Plus, Search, Sparkles } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { recentRepos, type RecentRepo } from "@/features/github/recent";
import { recentAgentTasks, type RecentTask } from "@/features/agent/store";
import { useProviders } from "@/features/ai/use-providers";
import { useSkills } from "@/features/skills/use-skills";
import { openCommandPalette, requestNewRepo } from "@/features/command/palette-store";
import { chatPath, projectPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import { Btn, Divider, Header, IconBtn, ListRow, Row, Section, Screen, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Rows separated by hairlines, without a card around them. */
function FlatList({ children }: { children: ReactNode[] }) {
  return (
    <View style={{ marginHorizontal: -16 }}>
      {children.map((child, i) => (
        <View key={i}>
          {i ? <Divider style={{ marginLeft: 49 }} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/** Looks like the chat composer and opens a fresh chat in the latest project. */
function AskRow({ latest }: { latest?: RecentRepo }) {
  const { c, a } = useTheme();
  return (
    <Pressable
      testID="button-start-building"
      accessibilityRole="button"
      accessibilityLabel={latest ? `New chat in ${latest.owner}/${latest.name}` : "Pick a repository to start a chat"}
      onPress={() => router.push(latest ? chatPath(latest.owner, latest.name, { branch: latest.branch, task: "new" }) : "/projects")}
      style={({ pressed }) => ({ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: pressed ? a("primary", 0.5) : c.border, backgroundColor: c.surface, paddingLeft: 16, paddingRight: 10 })}
    >
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 10 }}>
        <T style={{ fontSize: 16, color: c.mutedForeground }}>Ask Chrono to build…</T>
        <T variant="monoSmall" numberOfLines={1} style={{ marginTop: 2, fontSize: 12 }}>{latest ? `${latest.owner}/${latest.name} · ${latest.branch}` : "Pick a repository to start"}</T>
      </View>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
        <ArrowUp size={18} color={c.primaryForeground} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { session } = useSession();
  const providers = useProviders();
  const skills = useSkills();
  const [recent, setRecent] = useState<RecentRepo[]>(() => recentRepos());
  const [chats, setChats] = useState<RecentTask[]>(() => recentAgentTasks(4));
  useFocusEffect(
    useCallback(() => {
      setRecent(recentRepos());
      setChats(recentAgentTasks(4));
    }, []),
  );
  const first = session.mode === "github" ? (session.user.name ?? session.user.login).split(" ")[0] : null;
  const latest = recent[0];
  const newRepo = () => {
    requestNewRepo();
    router.navigate("/projects");
  };
  const ready = providers.state.status === "ready" ? providers.state.data : null;
  const def = ready?.providers.find((p) => p.id === ready.defaultId) ?? null;
  const providerLine = providers.state.status === "loading" ? "Loading…" : providers.state.status === "error" ? "Couldn't load providers" : def ? `${def.label} · ${def.model}` : "None yet — add one to use the agent";
  const skillsOn = skills.all.filter((s) => skills.enabled.includes(s.id)).length;

  return (
    <>
      <Header title="Chrono" large menu right={<IconBtn icon={Search} label="Search" size={48} onPress={openCommandPalette} testID="button-home-search" />} />
      <Screen>
        <View style={{ gap: 6, paddingTop: 8 }}>
          <T style={{ fontSize: 28, lineHeight: 34, fontFamily: FONT.semibold, letterSpacing: -0.4 }}>{first ? `${greeting()}, ${first}.` : `${greeting()}.`}</T>
          <T variant="small" style={{ fontSize: 15, lineHeight: 21 }}>Ask for a change, review the diff, preview it, ship it.</T>
        </View>

        <AskRow latest={latest} />

        <Section title="Recent projects" action={<T variant="small" color="primary" weight="semibold" onPress={() => router.navigate("/projects")} testID="link-all-projects" suppressHighlighting>All projects</T>}>
          {recent.length ? (
            <FlatList>
              {recent.slice(0, 5).map((r) => (
                <ListRow
                  key={`${r.owner}/${r.name}`}
                  testID={`card-recent-${r.owner}-${r.name}`}
                  icon={FolderGit2}
                  title={r.name}
                  subtitle={`${r.owner} · ${r.branch} · ${timeAgo(new Date(r.openedAt))}`}
                  onPress={() => router.push(projectPath(r.owner, r.name))}
                />
              ))}
            </FlatList>
          ) : (
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <T variant="small">No projects opened on this device yet. Open a repository or create a new one.</T>
              <Row style={{ flexWrap: "wrap" }}>
                <Btn label="Browse repositories" size="sm" onPress={() => router.navigate("/projects")} />
                <Btn label="New repository" size="sm" variant="secondary" icon={Plus} onPress={newRepo} />
              </Row>
            </View>
          )}
        </Section>

        {chats.length ? (
          <Section title="Recent chats" action={<T variant="small" color="primary" weight="semibold" onPress={() => router.push("/history")} testID="link-task-history" suppressHighlighting>History</T>}>
            <FlatList>
              {chats.map((r) => (
                <ListRow
                  key={`${r.key}/${r.task.id}`}
                  testID={`home-chat-${r.task.id}`}
                  icon={MessageSquareText}
                  title={r.task.title}
                  subtitle={`${r.repo} · ${timeAgo(new Date(r.task.updatedAt))}`}
                  onPress={() => router.push(chatPath(r.owner, r.repo, { branch: r.branch, task: r.task.id }))}
                />
              ))}
            </FlatList>
          </Section>
        ) : null}

        <Section title="Workspace">
          <FlatList>
            {[
              <ListRow key="new" testID="quick-new-repo" icon={Plus} title="New repository" subtitle="Create a GitHub repository and open it here" onPress={newRepo} />,
              <ListRow key="ai" testID="quick-connect-ai" icon={Bot} title="AI provider" subtitle={providerLine} onPress={() => router.push("/ai-providers")} />,
              <ListRow key="skills" testID="card-skills" icon={Sparkles} title="Skills" subtitle={`${skillsOn} of ${skills.all.length} enabled · in Settings`} onPress={() => router.push("/skills")} />,
              <ListRow key="preview" testID="quick-preview" icon={MonitorSmartphone} title="Preview" subtitle="Run a recent project in the live preview" onPress={() => router.push("/preview")} />,
            ]}
          </FlatList>
        </Section>
      </Screen>
    </>
  );
}
