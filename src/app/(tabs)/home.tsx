import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowRight, Bot, FolderGit2, GitBranch, MonitorSmartphone, Plus, Search, WandSparkles, type LucideIcon } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { recentRepos, type RecentRepo } from "@/features/github/recent";
import { useProviders } from "@/features/ai/use-providers";
import { useSkills } from "@/features/skills/use-skills";
import { openCommandPalette, requestNewRepo } from "@/features/command/palette-store";
import { projectPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import { Btn, Card, Header, IconBtn, Row, Screen, Section, Skeleton, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

function QuickAction({ icon: Icon, title, description, onPress, testID }: { icon: LucideIcon; title: string; description: string; onPress: () => void; testID: string }) {
  const { c, a } = useTheme();
  return (
    <Card onPress={onPress} testID={testID} style={{ flex: 1, minWidth: 150, padding: 14 }}>
      <View style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
        <Icon size={17} color={c.primary} />
      </View>
      <T variant="h3" style={{ fontSize: 14 }}>{title}</T>
      <T variant="tiny" style={{ marginTop: 3, lineHeight: 16 }}>{description}</T>
    </Card>
  );
}

function AiStatus() {
  const { state } = useProviders();
  const skills = useSkills();
  const ready = state.status === "ready" ? state.data : null;
  const def = ready?.providers.find((p) => p.id === ready.defaultId) ?? null;
  const on = skills.all.filter((s) => skills.enabled.includes(s.id)).length;
  return (
    <Row gap={10} center={false}>
      <Card onPress={() => router.push("/ai-providers")} testID="card-ai-provider" style={{ flex: 1, padding: 14 }}>
        <T variant="label" style={{ fontSize: 10 }}>Default AI provider</T>
        {state.status === "loading" ? (
          <Skeleton height={18} width="70%" style={{ marginTop: 8 }} />
        ) : state.status === "error" ? (
          <T variant="h3" color="danger" style={{ marginTop: 6, fontSize: 14 }}>Couldn't load providers</T>
        ) : def ? (
          <T variant="h3" numberOfLines={2} style={{ marginTop: 6, fontSize: 14 }}>
            {def.label} <T variant="monoSmall">· {def.model}</T>
          </T>
        ) : (
          <T variant="h3" color="warning" style={{ marginTop: 6, fontSize: 14 }}>None yet — add one to use the agent</T>
        )}
        <T variant="tiny" style={{ marginTop: 4 }}>Manage keys and models</T>
      </Card>
      <Card onPress={() => router.push("/skills")} testID="card-skills" style={{ flex: 1, padding: 14 }}>
        <T variant="label" style={{ fontSize: 10 }}>Skills</T>
        <T variant="h3" style={{ marginTop: 6, fontSize: 14 }}>
          {on} of {skills.all.length} enabled
        </T>
        <T variant="tiny" style={{ marginTop: 4 }}>Guidance Chrono applies to every chat</T>
      </Card>
    </Row>
  );
}

function RecentCard({ r }: { r: RecentRepo }) {
  const { c, a } = useTheme();
  return (
    <Card onPress={() => router.push(projectPath(r.owner, r.name))} testID={`card-recent-${r.owner}-${r.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
        <FolderGit2 size={20} color={c.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant="h3" numberOfLines={1}>
          <T variant="body" color="mutedForeground">{r.owner}/</T>
          {r.name}
        </T>
        <Row gap={6} style={{ marginTop: 3 }}>
          <GitBranch size={12} color={c.mutedForeground} />
          <T variant="monoSmall" numberOfLines={1} style={{ flexShrink: 1 }}>{r.branch}</T>
          <T variant="tiny">· Opened {timeAgo(new Date(r.openedAt))}</T>
        </Row>
      </View>
      <ArrowRight size={16} color={c.mutedForeground} />
    </Card>
  );
}

export default function HomeScreen() {
  const { session } = useSession();
  const { c, a } = useTheme();
  const [recent, setRecent] = useState<RecentRepo[]>(() => recentRepos());
  useFocusEffect(useCallback(() => setRecent(recentRepos()), []));
  const first = session.mode === "github" ? (session.user.name ?? session.user.login).split(" ")[0] : null;
  const latest = recent[0];
  const newRepo = () => {
    requestNewRepo();
    router.navigate("/projects");
  };
  return (
    <>
      <Header title="Home" large right={<IconBtn icon={Search} label="Search" onPress={openCommandPalette} testID="button-home-search" />} />
      <Screen>
        <Card style={{ padding: 18 }}>
          <T variant="label" color="primary" style={{ fontSize: 10 }}>AI development workspace</T>
          <T variant="title" style={{ marginTop: 8 }}>{first ? `Welcome back, ${first}.` : "Welcome back."}</T>
          <T variant="small" style={{ marginTop: 6, fontSize: 14, lineHeight: 20 }}>
            Open a repository, ask Chrono to change it, preview the result, and ship it as a commit or pull request.
          </T>
          <Pressable
            testID="button-start-building"
            onPress={() => router.push(latest ? projectPath(latest.owner, latest.name, "ai") : "/projects")}
            style={({ pressed }) => ({ marginTop: 16, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: a("primary", pressed ? 0.6 : 0.3), backgroundColor: c.background, paddingHorizontal: 14 })}
          >
            <View style={{ width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
              <WandSparkles size={16} color={c.primaryForeground} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="h3" style={{ fontSize: 14 }}>Ask Chrono to build</T>
              <T variant="tiny" numberOfLines={1}>{latest ? `in ${latest.owner}/${latest.name}` : "Pick a repository to start"}</T>
            </View>
            <ArrowRight size={16} color={c.primary} />
          </Pressable>
        </Card>

        <Row gap={10} style={{ flexWrap: "wrap" }} center={false}>
          <QuickAction onPress={newRepo} icon={Plus} title="New repository" description="Create a GitHub repository and open it here." testID="quick-new-repo" />
          <QuickAction onPress={() => router.navigate("/projects")} icon={FolderGit2} title="Browse projects" description="Open any repository you have access to." testID="quick-browse-projects" />
          <QuickAction onPress={() => router.push("/ai-providers")} icon={Bot} title="Connect an AI" description="Choose the model that powers your workspace." testID="quick-connect-ai" />
          <QuickAction onPress={() => router.push("/preview")} icon={MonitorSmartphone} title="Preview" description="Run a recent project in the live preview." testID="quick-preview" />
        </Row>

        <Section title="Continue building" action={<T variant="small" color="primary" weight="semibold" onPress={() => router.navigate("/projects")}>View all</T>}>
          {recent.length ? (
            recent.map((r) => <RecentCard key={`${r.owner}/${r.name}`} r={r} />)
          ) : (
            <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, padding: 22, alignItems: "center" }}>
              <FolderGit2 size={26} color={c.mutedForeground} />
              <T variant="h3" style={{ marginTop: 10 }}>Your next project starts here</T>
              <T variant="tiny" style={{ marginTop: 3 }}>Open a repository or create a new one.</T>
              <Row style={{ marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
                <Btn label="Browse repositories" size="sm" onPress={() => router.navigate("/projects")} />
                <Btn label="New repository" size="sm" variant="secondary" icon={Plus} onPress={newRepo} />
              </Row>
            </View>
          )}
        </Section>

        <AiStatus />
      </Screen>
    </>
  );
}
