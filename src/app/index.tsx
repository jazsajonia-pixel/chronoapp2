import { Redirect, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Bot, Check, GitBranch, GitPullRequestArrow, Layers, MonitorSmartphone, ShieldCheck, Smartphone, Sparkles } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { Badge, Btn, Card, Row, T } from "@/ui/kit";
import { GitHubIcon, Wordmark } from "@/ui/brand";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const FEATURES = [
  { icon: GitBranch, index: "01", title: "GitHub, in your pocket", body: "Browse branches, open files, and make focused edits without leaving the repo you already trust." },
  { icon: Bot, index: "02", title: "An agent with a plan", body: "Chrono turns a request into a visible plan, then presents every change as a reviewable diff." },
  { icon: MonitorSmartphone, index: "03", title: "Preview the real thing", body: "Run the app in a sandboxed preview so you can see what shipped — not a static screenshot." },
  { icon: Smartphone, index: "04", title: "Designed for one hand", body: "Bottom sheets, thumb-friendly controls, and a calm mobile workflow from first edit to PR." },
  { icon: Layers, index: "05", title: "Bring your model", body: "Use OpenAI, Anthropic, Gemini, OpenRouter, or an OpenAI-compatible endpoint behind one focused interface." },
  { icon: GitPullRequestArrow, index: "06", title: "Ship with confidence", body: "Work on an ai/ branch, review the diff, commit, push, and open a pull request when it is ready." },
] as const;
const PIPELINE = ["Connect", "Plan", "Edit", "Preview", "Ship"];

function WorkspacePreview() {
  const { c, a } = useTheme();
  const line = (n: string, parts: [string, keyof typeof c][]) => (
    <Row gap={6}>
      <T variant="monoSmall" style={{ width: 18, opacity: 0.6 }}>{n}</T>
      <T variant="monoSmall">
        {parts.map(([t, col], i) => (
          <T key={i} variant="monoSmall" style={{ color: c[col] }}>{t}</T>
        ))}
      </T>
    </Row>
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginTop: 28 }}>
      <View style={{ borderRadius: RADIUS.xl, borderWidth: 1, borderColor: a("primary", 0.25), backgroundColor: c.surface, overflow: "hidden" }}>
        <Row style={{ paddingHorizontal: 12, height: 36, borderBottomWidth: 1, borderBottomColor: c.border, justifyContent: "space-between" }}>
          <Row gap={5}>
            {[0, 1, 2].map((i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.border }} />)}
          </Row>
          <T variant="label" style={{ fontSize: 9 }}>AI WORKSPACE</T>
          <Row gap={5}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }} /><T variant="tiny">Ready</T></Row>
        </Row>
        <View style={{ padding: 12, gap: 4 }}>
          <Row gap={6} style={{ marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: c.surface2 }}><T variant="monoSmall" color="foreground">App.jsx</T></View>
            <T variant="monoSmall">task-count</T>
          </Row>
          {line("01", [["import ", "primary"], ["TaskList ", "foreground"], ["from ", "primary"], ['"./components"', "success"]])}
          {line("02", [["export default ", "primary"], ["function ", "primary"], ["App", "warning"], ["() {", "mutedForeground"]])}
          {line("03", [["  const ", "primary"], ["[tasks] = ", "foreground"], ["useTasks", "warning"], ["()", "mutedForeground"]])}
          {line("04", [["  return ", "primary"], ["<TaskList ", "danger"], ["count", "warning"], ["={tasks.length} />", "mutedForeground"]])}
        </View>
        <Row style={{ borderTopWidth: 1, borderTopColor: c.border, height: 38, justifyContent: "space-around" }}>
          {["Files", "AI", "Preview", "Git"].map((t) => (
            <T key={t} variant="tiny" style={t === "AI" ? { color: c.primary, fontFamily: FONT.semibold } : undefined}>{t}</T>
          ))}
        </Row>
      </View>
      <View style={{ position: "absolute", right: -4, top: -18, flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: RADIUS.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
        <Sparkles size={14} color={c.primary} />
        <View>
          <T variant="label" style={{ fontSize: 8 }}>AGENT PLAN</T>
          <T variant="small" color="foreground" weight="semibold">Update task count</T>
          <T variant="tiny">2 files · ready to review</T>
        </View>
        <Check size={14} color={c.success} />
      </View>
      <View style={{ position: "absolute", left: -4, bottom: -16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 30, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
        <GitBranch size={13} color={c.foreground} />
        <T variant="monoSmall" color="foreground">ai/task-count</T>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.success }} />
      </View>
    </View>
  );
}

export default function Landing() {
  const { isAuthed, loading } = useSession();
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  if (!loading && isAuthed) return <Redirect href="/home" />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Row style={{ justifyContent: "space-between", height: 52 }}>
        <Wordmark />
        <Badge label="Early access" tone="success" />
      </Row>
      <View style={{ marginTop: 28 }}>
        <Row gap={8}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} />
          <T variant="label" color="primary">AI DEVELOPMENT, REIMAGINED</T>
        </Row>
        <T variant="display" style={{ marginTop: 14 }}>
          Build what’s next.{"\n"}
          <T variant="display" style={{ color: c.primary }}>From anywhere.</T>
        </T>
        <T variant="body" color="mutedForeground" style={{ marginTop: 14 }}>
          A mobile-first development environment that brings your GitHub repos, AI agent, live preview, and pull requests together — in one calm workspace.
        </T>
        <View style={{ marginTop: 22, gap: 10 }}>
          <Btn
            size="lg"
            full
            label={isAuthed ? "Open workspace" : "Continue with GitHub"}
            icon={isAuthed ? undefined : () => <GitHubIcon size={17} color={c.primaryForeground} />}
            iconRight={ArrowRight}
            onPress={() => router.push(isAuthed ? "/home" : "/signin")}
            testID="button-get-started"
          />
          <T variant="tiny" style={{ textAlign: "center" }}>Free during early access · Your GitHub token never leaves the server</T>
        </View>
        <WorkspacePreview />
      </View>

      <View style={{ marginTop: 52, gap: 10 }}>
        <T variant="label">One clear path to shipped code</T>
        <Row gap={6} style={{ flexWrap: "wrap" }}>
          {PIPELINE.map((step, i) => (
            <Row key={step} gap={6}>
              <View style={{ paddingHorizontal: 10, height: 28, borderRadius: 999, borderWidth: 1, borderColor: c.border, justifyContent: "center", backgroundColor: c.surface }}>
                <T variant="small" color="foreground">
                  <T variant="monoSmall" color="primary">{`0${i + 1} `}</T>
                  {step}
                </T>
              </View>
              {i < PIPELINE.length - 1 ? <ArrowRight size={12} color={c.mutedForeground} /> : null}
            </Row>
          ))}
        </Row>
      </View>

      <View style={{ marginTop: 44, gap: 12 }}>
        <T variant="label" color="primary">THE WORKSPACE</T>
        <T variant="title">Everything between a repo and a pull request.</T>
        {FEATURES.map((f) => (
          <Card key={f.index} style={{ gap: 8 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
                <f.icon size={18} color={c.primary} />
              </View>
              <T variant="monoSmall">{f.index}</T>
            </Row>
            <T variant="h3">{f.title}</T>
            <T variant="small">{f.body}</T>
          </Card>
        ))}
      </View>

      <Card style={{ marginTop: 36, gap: 10 }} tone="primary">
        <ShieldCheck size={26} color={c.primary} />
        <T variant="h2">Secure by default</T>
        {[
          "GitHub tokens are sealed server-side; the app only holds an encrypted session in the device keychain.",
          "Your AI keys are encrypted at rest (AES-256-GCM) and never sent back to the device.",
          "Previews run sandboxed, isolated from your account.",
        ].map((t) => (
          <Row key={t} center={false} gap={8}>
            <Check size={15} color={c.success} style={{ marginTop: 3 }} />
            <T variant="small" style={{ flex: 1 }}>{t}</T>
          </Row>
        ))}
      </Card>

      <View style={{ marginTop: 40, alignItems: "center", gap: 12 }}>
        <T variant="label">THE NEXT COMMIT IS CLOSER THAN YOU THINK</T>
        <T variant="title" style={{ textAlign: "center" }}>
          Make your best ideas <T variant="title" style={{ color: c.primary }}>shippable from anywhere.</T>
        </T>
        <Btn label={isAuthed ? "Open workspace" : "Get started"} iconRight={ArrowRight} onPress={() => router.push(isAuthed ? "/home" : "/signin")} />
      </View>
      <T variant="tiny" style={{ textAlign: "center", marginTop: 36 }}>Chrono · Early access · Built for developers who code on the go</T>
    </ScrollView>
  );
}
