import { View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, ChevronRight, MonitorPlay, XCircle } from "lucide-react-native";
import { recentRepos } from "@/features/github/recent";
import { projectPath } from "@/lib/nav";
import { Card, Divider, Header, ListRow, Row, Screen, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

const SUPPORTED = ["Static HTML / CSS / JavaScript (multi-page)", "Vite + React / Preact (JS & TypeScript)", "Create React App", "Tailwind CSS v3 / v4, CSS modules, JSON & asset imports", "npm packages (loaded from esm.sh at your package.json versions)"];
const EDITOR_LANGUAGES = "PHP, Python, Go, Rust, Ruby, SQL, YAML, shell, and TOML files are syntax-highlighted in the editor.";
const NOT_YET = [
  "Server runtimes: Next.js, Remix, Nuxt, SvelteKit, Astro, Node/Express APIs",
  "Vue, Svelte, Angular, Solid single-file components",
  "Native apps: React Native / Expo, Flutter, Electron",
  "Server-rendered backends and databases (PHP, Python, Go, Ruby…) — these need a server runtime",
];

export default function PreviewHub() {
  const { c } = useTheme();
  const items = recentRepos().slice(0, 8);
  return (
    <>
      <Header title="Preview" back />
      <Screen>
        <T variant="small" style={{ fontSize: 14 }}>Runs the real app — including unsaved edits — in a sandboxed view on this device. Pick a project:</T>
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
        <Card style={{ gap: 8 }}>
          <T variant="h3">Supported</T>
          {SUPPORTED.map((s) => (
            <Row key={s} center={false} gap={8}>
              <CheckCircle2 size={15} color={c.success} style={{ marginTop: 2 }} />
              <T variant="small" style={{ flex: 1 }}>{s}</T>
            </Row>
          ))}
        </Card>
        <Card style={{ gap: 8 }}>
          <T variant="h3">Not in the preview yet</T>
          {NOT_YET.map((s) => (
            <Row key={s} center={false} gap={8}>
              <XCircle size={15} color={c.mutedForeground} style={{ marginTop: 2 }} />
              <T variant="small" style={{ flex: 1 }}>{s}</T>
            </Row>
          ))}
        </Card>
        <T variant="tiny">Editor support and preview are different: {EDITOR_LANGUAGES} The preview only executes frontend code in a sandbox, so PHP and other server languages need deployment or a server runtime to run.</T>
      </Screen>
    </>
  );
}
