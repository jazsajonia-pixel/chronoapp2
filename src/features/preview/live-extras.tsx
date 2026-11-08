import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, View } from "react-native";
import { Download, KeyRound, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { Btn, Field, IconBtn, Row, Sheet, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";
import { previewEnvNameProblem, usePreviewEnv } from "./use-preview-env";

/**
 * Live server variables for this repository (same API as the website). Values are write-only: once
 * saved they're encrypted on Chrono's server and never shown again; only names come back.
 */
export function LiveEnvSheet({ owner, repo, open, onClose, suggested = [] }: { owner: string; repo: string; open: boolean; onClose: () => void; suggested?: readonly string[] }) {
  const { c } = useTheme();
  const env = usePreviewEnv(owner, repo, open);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const close = () => {
    setName("");
    setValue("");
    setError(null);
    onClose();
  };
  const saved = env.state.status === "ready" ? env.state.vars : [];
  const missing = suggested.filter((s) => !saved.some((v) => v.name === s));
  const problem = name ? previewEnvNameProblem(name.trim()) : null;

  const submit = async () => {
    const n = name.trim();
    const p = previewEnvNameProblem(n);
    if (p) return setError(p);
    setBusy("save");
    setError(null);
    try {
      await env.save(n, value);
      setName("");
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the variable.");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (n: string) => {
    setBusy(n);
    setError(null);
    try {
      await env.remove(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove the variable.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={close} title="Preview variables" description={`Passed to ${owner}/${repo}'s live server only. Use development credentials, never production ones.`}>
      <View testID="live-env-sheet" style={{ gap: 12 }}>
        {env.state.status === "loading" ? (
          <Row><ActivityIndicator color={c.primary} /><T variant="small">Loading…</T></Row>
        ) : env.state.status === "error" ? (
          <T variant="small" color="danger" accessibilityRole="alert">{env.state.error}</T>
        ) : !env.state.available ? (
          <T variant="small">{env.state.reason}</T>
        ) : (
          <>
            {saved.length ? (
              <View testID="live-env-list" style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md }}>
                {saved.map((v, i) => (
                  <Row key={v.name} gap={8} style={{ paddingLeft: 12, paddingRight: 4, minHeight: 48, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <KeyRound size={14} color={c.mutedForeground} />
                    <T variant="monoSmall" color="foreground" numberOfLines={1} style={{ flex: 1 }}>{v.name}</T>
                    <T variant="tiny">saved {new Date(v.updatedAt).toLocaleDateString()}</T>
                    <IconBtn icon={Trash2} label={`Remove ${v.name}`} size={40} disabled={busy !== null} onPress={() => void remove(v.name)} />
                  </Row>
                ))}
              </View>
            ) : (
              <T variant="small">No variables yet. The live server starts without any.</T>
            )}
            {missing.length ? (
              <Row gap={6} style={{ flexWrap: "wrap" }}>
                {missing.map((s) => (
                  <Pressable key={s} onPress={() => setName(s)} accessibilityRole="button" accessibilityLabel={`Add ${s}`} style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border }}>
                    <T variant="monoSmall">+ {s}</T>
                  </Pressable>
                ))}
              </Row>
            ) : null}
            <Field label="Name" mono value={name} onChangeText={setName} placeholder="DATABASE_URL" autoCapitalize="characters" error={problem} testID="input-env-name" />
            <Field label="Value" mono value={value} onChangeText={setValue} placeholder="Value" secureTextEntry autoComplete="off" textContentType="none" testID="input-env-value" />
            {problem || error ? <T variant="small" color="danger" accessibilityRole="alert">{problem ?? error}</T> : null}
            <Btn label="Save variable" full loading={busy === "save"} disabled={busy !== null || !name.trim() || !!problem} onPress={() => void submit()} testID="button-save-env" />
            <T variant="tiny">Values are encrypted on Chrono's server and can't be viewed again. Restart the live server to use changes. Anyone with the preview link can use the running app, so keep these to test data.</T>
          </>
        )}
      </View>
    </Sheet>
  );
}

interface ReleaseApk { name: string; size: number; url: string; kind: "apk" | "aab" }
interface Release { tag: string; name: string; url: string; prerelease: boolean; publishedAt: string | null; apks: ReleaseApk[] }
type ReleasesState = { status: "loading" } | { status: "ready"; releases: Release[] } | { status: "error"; error: string };

/** Android apps can't run on a web server; offer the repository's own release builds instead. */
export function AndroidReleases({ owner, repo }: { owner: string; repo: string }) {
  const { c } = useTheme();
  const [state, setState] = useState<ReleasesState>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    api<{ releases: Release[] }>(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`)
      .then((r) => alive && setState({ status: "ready", releases: r.releases }))
      .catch((e: unknown) => alive && setState({ status: "error", error: e instanceof Error ? e.message : "Couldn't load releases." }));
    return () => {
      alive = false;
    };
  }, [owner, repo]);

  return (
    <View testID="android-releases" style={{ alignSelf: "stretch", maxWidth: 480, padding: 12, gap: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
      <T variant="small" color="foreground" weight="semibold">Install a build on this phone</T>
      {state.status === "loading" ? (
        <Row><ActivityIndicator size="small" color={c.primary} /><T variant="small">Checking releases…</T></Row>
      ) : state.status === "error" ? (
        <T variant="small" color="danger">{state.error}</T>
      ) : state.releases.length === 0 ? (
        <T variant="small">No release on GitHub has an .apk yet. Publish one (for example from a GitHub Actions build) and it shows up here.</T>
      ) : (
        state.releases.map((r) => (
          <View key={r.tag} style={{ gap: 6 }}>
            <T variant="small" color="foreground">{r.name}{r.prerelease ? " · pre-release" : ""}{r.publishedAt ? " · " + new Date(r.publishedAt).toLocaleDateString() : ""}</T>
            {r.apks.map((a) => (
              <Btn key={a.url} label={`${a.name} · ${(a.size / 1_048_576).toFixed(1)} MB`} icon={Download} size="sm" variant="secondary" onPress={() => void Linking.openURL(a.url).catch(() => undefined)} />
            ))}
          </View>
        ))
      )}
      <T variant="tiny">Downloads open in your browser. Android asks before installing apps from outside the Play Store.</T>
    </View>
  );
}
