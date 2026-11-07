import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Code2, ExternalLink, Maximize2, Minimize2, Play, RotateCw, ServerOff, Square, Terminal } from "lucide-react-native";
import type { WorkspaceTab } from "@/lib/nav";
import { Btn, IconBtn, Row, Sheet, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";
import { useLiveServer } from "./use-live-server";

const DISCLOSURE =
  "Chrono copies current editor files, including unsaved edits, into an isolated Vercel Sandbox. The server expires after 10 minutes. Anyone with the preview URL can view the site, so do not put secrets in project files.";

function originOf(url: string): string | null {
  const m = /^(https:\/\/[^/?#]+)/i.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Preview for projects that need a real server (Next.js, Express, Astro…): the project's own dev/start
 * script runs in a Vercel Sandbox via the Chrono backend, and this WebView only loads the sandbox URL.
 */
export function LivePanel({ owner, repo, label, onTab }: { owner: string; repo: string; label: string; onTab: (t: WorkspaceTab) => void }) {
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  const live = useLiveServer(owner, repo);
  const { status, url, logs, error, message } = live.state;
  const [full, setFull] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const transitioning = status === "starting" || status === "stopping";
  const { start } = live;

  // Same as the website: opening Preview on a server project starts it once; failures wait for Retry.
  useEffect(() => {
    if (status === "idle") void start();
  }, [status, start]);
  useEffect(() => setLoadError(null), [url, live.frameKey]);

  const statusText =
    status === "running" ? "Live server ready"
    : status === "starting" ? (message ?? "Starting live server…")
    : status === "stopping" ? "Stopping live server…"
    : status === "failed" ? "Live server failed"
    : status === "idle" ? "Live server not started" : "Live server stopped";

  const openExternal = () => {
    if (url) void Linking.openURL(url).catch(() => undefined);
  };

  const sandboxOrigin = url ? originOf(url) : null;
  const onShouldStart = (req: ShouldStartLoadRequest) => {
    if (req.isTopFrame === false) return true;
    if (sandboxOrigin && originOf(req.url) === sandboxOrigin) return true;
    if (req.url.startsWith("about:") || req.url.startsWith("blob:") || req.url.startsWith("data:")) return true;
    // Anything else (OAuth pages, external links) leaves the app instead of loading inside it.
    if (/^(https?|mailto|tel):/i.test(req.url)) void Linking.openURL(req.url).catch(() => undefined);
    return false;
  };

  const toolbar = (
    <Row gap={2} style={{ paddingHorizontal: 8, minHeight: 48, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Row gap={6} style={{ flex: 1, minWidth: 0, paddingLeft: 4 }} testID="preview-status">
        {transitioning ? <ActivityIndicator size="small" color={c.primary} /> : status === "failed" ? <AlertTriangle size={14} color={c.danger} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status === "running" ? c.success : c.mutedForeground }} />}
        <T variant="small" color="foreground" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityLiveRegion="polite">{statusText}</T>
      </Row>
      {status === "running" ? (
        <Btn label="Stop" icon={Square} size="sm" variant="outline" onPress={live.stop} testID="button-stop-live-server" />
      ) : (
        <Btn label={status === "failed" ? "Retry" : "Start"} icon={Play} size="sm" onPress={live.start} disabled={transitioning} testID="button-start-live-server" />
      )}
      <IconBtn icon={RotateCw} label="Reload live preview" size={44} onPress={live.reload} disabled={status !== "running"} testID="button-reload-preview" />
      <IconBtn icon={ExternalLink} label="Open live preview in browser" size={44} onPress={openExternal} disabled={!url} testID="button-open-live-preview" />
      <IconBtn icon={full ? Minimize2 : Maximize2} label={full ? "Exit full screen" : "Full screen"} size={44} onPress={() => setFull(!full)} testID="button-fullscreen" />
    </Row>
  );

  const stage =
    status === "running" && url ? (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <WebView
          key={live.frameKey}
          testID="live-server-frame"
          accessibilityLabel={`Live preview of ${repo}`}
          source={{ uri: url }}
          originWhitelist={["https://*", "about:*", "blob:*", "data:*"]}
          javaScriptEnabled
          domStorageEnabled
          incognito
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          allowFileAccess={false}
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={onShouldStart}
          onError={(e) => setLoadError(e.nativeEvent.description || "The page couldn't be loaded.")}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setLoadError(`The server answered ${e.nativeEvent.statusCode}. Check the logs, then reload.`); }}
          style={{ flex: 1, backgroundColor: "#fff" }}
          containerStyle={{ backgroundColor: "#fff" }}
        />
        {loadError ? (
          <View accessibilityRole="alert" style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: 12, gap: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a("danger", 0.4), backgroundColor: c.surface }}>
            <T variant="small" color="foreground">{loadError}</T>
            <Row>
              <Btn label="Logs" icon={Terminal} size="sm" variant="secondary" onPress={() => setLogsOpen(true)} disabled={!logs} />
              <Btn label="Reload" icon={RotateCw} size="sm" variant="secondary" onPress={live.reload} />
            </Row>
          </View>
        ) : null}
      </View>
    ) : (
      <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ padding: 24, gap: 12, alignItems: "center", flexGrow: 1, justifyContent: "center" }}>
        {transitioning ? <ActivityIndicator color={c.primary} /> : status === "failed" ? <AlertTriangle size={28} color={c.danger} /> : <ServerOff size={28} color={c.mutedForeground} />}
        <T variant="h3" style={{ textAlign: "center" }}>
          {status === "starting" ? (message ?? "Starting your project…")
            : status === "failed" ? (message ?? "The live server could not start.")
            : status === "stopping" ? "Stopping your server…"
            : status === "idle" ? "Run this project's dev server in a cloud sandbox."
            : (message ?? "Your live server is stopped.")}
        </T>
        {error ? <T variant="small" color="danger" accessibilityRole="alert" selectable style={{ textAlign: "center" }}>{error}</T> : null}
        {status === "idle" || status === "stopped" ? <Btn label={status === "idle" ? "Start live server" : "Start again"} icon={Play} onPress={live.start} testID="button-start-live-server-body" /> : null}
        <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {logs ? <Btn label="Server logs" icon={Terminal} variant="secondary" size="sm" onPress={() => setLogsOpen(true)} testID="button-live-logs" /> : null}
          <Btn label="Back to code" icon={Code2} variant="secondary" size="sm" onPress={() => onTab("files")} />
        </Row>
        <T variant="tiny" style={{ textAlign: "center", maxWidth: 420 }}>{label} · {DISCLOSURE}</T>
      </ScrollView>
    );

  return (
    <View style={{ flex: 1 }} testID="preview-panel">
      {full ? null : toolbar}
      {full ? <View style={{ flex: 1 }} /> : stage}
      {!full && status === "running" ? (
        <Pressable onPress={() => setLogsOpen(true)} accessibilityRole="button" accessibilityLabel="Server logs" style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.border }}>
          <T variant="tiny" numberOfLines={1}>
            Vercel Sandbox · includes unsaved edits{live.state.files ? ` · ${live.state.files} files` : ""} · expires after 10 min · logs
          </T>
        </Pressable>
      ) : null}

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)} presentationStyle="fullScreen" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {toolbar}
          {stage}
        </View>
      </Modal>

      <Sheet open={logsOpen} onClose={() => setLogsOpen(false)} title="Server logs" description={DISCLOSURE}>
        {logs ? (
          <ScrollView horizontal style={{ borderRadius: RADIUS.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }} contentContainerStyle={{ padding: 10 }}>
            <Text selectable testID="live-server-logs" style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 16, color: c.foreground }}>{logs}</Text>
          </ScrollView>
        ) : (
          <T variant="small">No server output yet.</T>
        )}
        {live.state.skippedAssets?.length ? <T variant="tiny">Not copied: {live.state.skippedAssets.join(", ")}</T> : null}
      </Sheet>
    </View>
  );
}
