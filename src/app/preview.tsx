import { View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, ChevronRight, MonitorPlay, XCircle } from "lucide-react-native";
import { recentRepos } from "@/features/github/recent";
import { projectPath } from "@/lib/nav";
import { Card, Divider, Header, ListRow, Row, Screen, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

const MODES = [
  {
    title: "On this device",
    body: "Instant. Runs frontend code in a sandboxed view — nothing leaves the phone except npm packages from esm.sh.",
    items: ["Static HTML / CSS / JavaScript (multi-page)", "Vite + React / Preact (JS & TypeScript), Create React App", "Tailwind CSS v3 / v4, CSS modules, JSON & asset imports", "npm packages (loaded from esm.sh at your package.json versions)"],
  },
  {
    title: "Live server",
    body: "A temporary cloud sandbox (up to 10 minutes) that installs dependencies and runs your dev script. The phone only shows the page.",
    items: ["Node projects with a dev or start script (tested with Next.js and Vite)", "API routes and server code run for real", "Images, fonts and other binary files are copied from GitHub"],
  },
] as const;
const EDITOR_LANGUAGES = "PHP, Python, Go, Rust, Ruby, SQL, YAML, shell, and TOML files are syntax-highlighted in the editor.";
const NOT_YET = ["Native apps: React Native / Expo, Flutter, Electron", "Non-Node backends (PHP, Python, Go, Ruby…) and databases"];

export default function PreviewHub() {
  const { c } = useTheme();
  const items = recentRepos().slice(0, 8);
  return (
    <>
      <Header title="Preview" menu />
      <Screen>
        <T variant="small" style={{ fontSize: 14 }}>Run a project — including unsaved edits — on this device or on a live server. Pick one to open its Preview tab.</T>
        {items.length ? (
          <View testID="list-preview-projects" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
            {items.map((r, i) => (
              <View key={`${r.owner}/${r.name}`}>
                {i ? <Divider /> : null}
                <ListRow icon={MonitorPlay} title={`${r.owner}/${r.name}`} onPress={() => router.push(projectPath(r.owner, r.name, "preview"))} right={<ChevronRight size={16} color={c.mutedForeground} />} testID={`link-preview-${r.owner}-${r.name}`} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, padding: 16 }} testID="text-preview-empty">
            <T variant="small">
              Open a repository from{" "}
              <T variant="small" color="primary" onPress={() => router.navigate("/projects")}>Projects</T> and it will appear here.
            </T>
          </View>
        )}
        {MODES.map((m) => (
          <Card key={m.title} style={{ gap: 8 }}>
            <T variant="h3">{m.title}</T>
            <T variant="tiny">{m.body}</T>
            {m.items.map((s) => (
              <Row key={s} center={false} gap={8}>
                <CheckCircle2 size={15} color={c.success} style={{ marginTop: 2 }} />
                <T variant="small" style={{ flex: 1 }}>{s}</T>
              </Row>
            ))}
          </Card>
        ))}
        <Card style={{ gap: 8 }}>
          <T variant="h3">Not supported yet</T>
          {NOT_YET.map((s) => (
            <Row key={s} center={false} gap={8}>
              <XCircle size={15} color={c.mutedForeground} style={{ marginTop: 2 }} />
              <T variant="small" style={{ flex: 1 }}>{s}</T>
            </Row>
          ))}
        </Card>
        <T variant="tiny">Editor support and preview are different: {EDITOR_LANGUAGES} Non-Node server languages still need their own deployment to run.</T>
      </Screen>
    </>
  );
}
