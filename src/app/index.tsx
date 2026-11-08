import { Redirect, router } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Bot, Check, GitBranch, GitPullRequestArrow, Layers, MonitorSmartphone, ShieldCheck, Smartphone, Sparkles } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { AppError } from "@/lib/errors";
import { Badge, Btn, Card, ErrorState, Row, T } from "@/ui/kit";
import { GitHubIcon, Wordmark } from "@/ui/brand";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/** Same copy as the website's landing (chrono src/pages/landing.tsx). */
const STEPS = [
  { title: "Connect", body: "Sign in with GitHub and open any repository you can access." },
  { title: "Ask", body: "Describe the change. The agent reads the code and writes a plan." },
  { title: "Review", body: "Every edit arrives as a diff you accept or reject, file by file." },
  { title: "Preview", body: "Run the app in the app or on a live server, unsaved edits included." },
  { title: "Ship", body: "Commit to a working branch, push, and open a pull request." },
] as const;
const FEATURES = [
  { icon: GitBranch, title: "The repo you already trust", body: "Branches, files and commit history load straight from GitHub, at the branch you pick." },
  { icon: Bot, title: "An agent that shows its work", body: "Requests become a visible plan, then reviewable diffs. Nothing is written until you accept it." },
  { icon: MonitorSmartphone, title: "A preview of the real app", body: "Static sites and Vite apps run on the device; Node projects such as Next.js run on a temporary live server." },
  { icon: Smartphone, title: "Made for a phone", body: "Bottom sheets, a keyboard-aware editor with a symbol bar, and controls sized for your thumb." },
  { icon: Layers, title: "Your choice of model", body: "OpenAI, Anthropic, Gemini, OpenRouter or any OpenAI-compatible endpoint, with keys kept on the server." },
  { icon: GitPullRequestArrow, title: "Branch first, always", body: "Changes go to an ai/ branch so main stays untouched until you merge the pull request." },
] as const;

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
  // A static sketch of the real workspace (top tabs, code, agent plan). Everything sits in normal
  // flow — no floating chips — so nothing overlaps at small widths or large text sizes.
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginTop: 28, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: a("primary", 0.25), backgroundColor: c.surface, overflow: "hidden" }}>
      <Row style={{ paddingHorizontal: 12, minHeight: 38, justifyContent: "space-between" }}>
        <T variant="monoSmall" color="foreground">you/task-app</T>
        <Row gap={4}>
          <GitBranch size={11} color={c.mutedForeground} />
          <T variant="monoSmall">ai/task-count</T>
        </Row>
      </Row>
      <Row gap={18} style={{ paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {["Files", "AI", "Preview", "Git"].map((t) => (
          <View key={t} style={{ paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: t === "AI" ? c.primary : "transparent" }}>
            <T variant="tiny" style={t === "AI" ? { color: c.foreground, fontFamily: FONT.semibold } : undefined}>{t}</T>
          </View>
        ))}
      </Row>
      <View style={{ padding: 12, gap: 4 }}>
        <T variant="monoSmall" style={{ marginBottom: 6 }}>App.jsx</T>
        {line("01", [["import ", "primary"], ["TaskList ", "foreground"], ["from ", "primary"], ['"./components"', "success"]])}
        {line("02", [["export default ", "primary"], ["function ", "primary"], ["App", "warning"], ["() {", "mutedForeground"]])}
        {line("03", [["  const ", "primary"], ["[tasks] = ", "foreground"], ["useTasks", "warning"], ["()", "mutedForeground"]])}
        {line("04", [["  return ", "primary"], ["<TaskList ", "danger"], ["count", "warning"], ["={tasks.length} />", "mutedForeground"]])}
      </View>
      <Row gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
        <Sparkles size={14} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="small" color="foreground" weight="semibold" numberOfLines={1}>Plan: update task count</T>
          <T variant="tiny" numberOfLines={1}>2 files · ready to review</T>
        </View>
        <Check size={14} color={c.success} />
      </Row>
    </View>
  );
}

export default function Landing() {
  const { isAuthed, loading, restoreError, refresh } = useSession();
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  if (!loading && isAuthed) return <Redirect href="/home" />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
      <Row style={{ justifyContent: "space-between", height: 52 }}>
        <Wordmark />
        <Badge label="Early access" tone="primary" />
      </Row>
      <View style={{ marginTop: 28 }}>
        {restoreError ? (
          <ErrorState error={new AppError(restoreError, "Couldn't restore your session")} onRetry={() => void refresh()} style={{ marginBottom: 20 }} />
        ) : null}
        <T variant="display">
          Build, preview and ship your GitHub projects <T variant="display" style={{ color: c.primaryText }}>from anywhere.</T>
        </T>
        <T variant="body" color="mutedForeground" style={{ marginTop: 14 }}>
          Open a repository, ask the AI agent for a change, review the diff, run the app and open a pull request — in one workspace.
        </T>
        <View style={{ marginTop: 22, gap: 10 }}>
          <Btn
            size="lg"
            full
            label={isAuthed ? "Open your projects" : "Continue with GitHub"}
            icon={isAuthed ? undefined : () => <GitHubIcon size={17} color={c.primaryForeground} />}
            iconRight={ArrowRight}
            onPress={() => router.push(isAuthed ? "/home" : "/signin")}
            testID="button-get-started"
          />
          <T variant="tiny" style={{ textAlign: "center" }}>Your GitHub token never leaves the server</T>
        </View>
        <WorkspacePreview />
      </View>

      <View style={{ marginTop: 52, gap: 14 }}>
        <T variant="title" accessibilityRole="header">From request to pull request</T>
        {STEPS.map((step, i) => (
          <Row key={step.title} center={false} gap={12}>
            <View style={{ width: 2, alignSelf: "stretch", borderRadius: 1, backgroundColor: i === 0 ? c.primary : c.border }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h3">{step.title}</T>
              <T variant="small">{step.body}</T>
            </View>
          </Row>
        ))}
      </View>

      <View style={{ marginTop: 44, gap: 16 }}>
        <T variant="title" accessibilityRole="header">Everything between a repo and a merge</T>
        {FEATURES.map((f) => (
          <Row key={f.title} center={false} gap={12}>
            <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
              <f.icon size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="h3">{f.title}</T>
              <T variant="small">{f.body}</T>
            </View>
          </Row>
        ))}
      </View>

      <Card style={{ marginTop: 36, gap: 10 }} tone="primary">
        <ShieldCheck size={26} color={c.primary} />
        <T variant="h2">Your code and keys stay where they belong</T>
        {[
          "GitHub tokens are sealed on the server; the app only holds an encrypted session in the device keychain.",
          "AI provider keys are encrypted at rest and only used by server functions.",
          "Every change lands on a working branch first.",
          "Previews run sandboxed; live servers run in an isolated sandbox that shuts down after 10 minutes.",
        ].map((t) => (
          <Row key={t} center={false} gap={8}>
            <Check size={15} color={c.primary} style={{ marginTop: 3 }} />
            <T variant="small" style={{ flex: 1 }}>{t}</T>
          </Row>
        ))}
      </Card>

      <View style={{ marginTop: 40, alignItems: "center", gap: 12 }}>
        <T variant="title" style={{ textAlign: "center" }}>Open a repository and try it.</T>
        <T variant="small" style={{ textAlign: "center" }}>Chrono is in early access. All you need is a GitHub account.</T>
        <Btn label={isAuthed ? "Open your projects" : "Continue with GitHub"} iconRight={ArrowRight} onPress={() => router.push(isAuthed ? "/home" : "/signin")} />
      </View>
      <T variant="tiny" style={{ textAlign: "center", marginTop: 36 }}>Chrono · Early access</T>
    </ScrollView>
  );
}

// A crash here stays on this screen (Try again / Go home) instead of taking down the app.
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/error-boundary";
