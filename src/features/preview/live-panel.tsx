import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Code2, Copy, ExternalLink, Globe, Maximize2, Minimize2, Play, RotateCw, ServerOff, Share2, Sparkles, Square, Terminal, X } from "lucide-react-native";
import type { WorkspaceTab } from "@/lib/nav";
import { useWorkspace } from "@/features/workspace/context";
import { RequirementsSection } from "@/features/project/requirements-section";
import { useProjectRequirements } from "@/features/project/use-requirements";
import { Btn, IconBtn, Row, Sheet, T, toast } from "@/ui/kit";
import { FONT, RADIUS, useTheme, type ColorName } from "@/ui/theme";
import { useLiveServer } from "./use-live-server";
import { prefillAgent } from "./agent-prefill";
import { DESKTOP_VIEWPORT, DeviceFrame, DeviceToggle, type Device } from "./viewport";
import {
  LIVE_CAPTURE_JS,
  clearLiveCapture,
  forgetLiveDiagnostics,
  liveFixPrompt,
  parseLiveMessage,
  recordLiveMessage,
  updateLiveDiagnostics,
  type LiveConsoleEntry,
  type LiveRuntimeError,
} from "./live-diagnostics";

const LEVEL_COLOR: Record<LiveConsoleEntry["level"], ColorName> = { log: "foreground", debug: "mutedForeground", info: "primary", warn: "warning", error: "danger" };

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
  const requirements = useProjectRequirements();
  const { status, url, logs, error, message } = live.state;
  const [full, setFull] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("fit");
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Captured browser output belongs to one page load; a reload, new URL or viewport starts afresh.
  const [capture, setCapture] = useState<{ key: string; entries: LiveConsoleEntry[]; errors: LiveRuntimeError[]; dismissed: number }>({ key: "", entries: [], errors: [], dismissed: 0 });
  const transitioning = status === "starting" || status === "stopping";
  const { start } = live;
  const { storageKey } = useWorkspace().source;

  // Share status, logs and captured browser errors with the agent's request_preview tool.
  useEffect(() => {
    updateLiveDiagnostics(storageKey, { status, url, logs, error, message, files: live.state.files });
  }, [storageKey, status, url, logs, error, message, live.state.files]);
  useEffect(() => () => forgetLiveDiagnostics(storageKey), [storageKey]);
  const loadKey = `${storageKey}|${url ?? ""}|${live.frameKey}|${device}`;
  useEffect(() => clearLiveCapture(storageKey), [storageKey, loadKey]);
  const current = capture.key === loadKey ? capture : { key: loadKey, entries: [], errors: [], dismissed: 0 };
  const entries = current.entries;
  const runtimeErrors = current.errors;
  const errorDismissed = current.dismissed;
  const setErrorDismissed = (n: number) => setCapture({ ...current, dismissed: n });
  const resetCapture = () => {
    clearLiveCapture(storageKey);
    setCapture({ key: loadKey, entries: [], errors: [], dismissed: 0 });
  };

  const onFrameMessage = (raw: string) => {
    const msg = parseLiveMessage(raw);
    if (!msg) return;
    const d = recordLiveMessage(storageKey, msg);
    setCapture((cur) => ({ key: loadKey, entries: d.console, errors: d.errors, dismissed: cur.key === loadKey ? cur.dismissed : 0 }));
  };
  const askAi = (runtime?: LiveRuntimeError) => {
    prefillAgent(storageKey, liveFixPrompt({ status, error, logs, errors: runtimeErrors }, runtime), "agent");
    setFull(false);
    setConsoleOpen(false);
    setLogsOpen(false);
    onTab("ai");
  };
  const copyUrl = async () => {
    if (!url) return;
    try {
      await Clipboard.setStringAsync(url);
      toast("Preview link copied", "success");
    } catch {
      toast("Couldn't copy the link", "danger");
    }
  };
  const shareUrl = () => {
    if (url) void Share.share({ message: url, url }).catch(() => undefined);
  };
  const errorCount = entries.filter((e) => e.level === "error").length;
  const latestError = runtimeErrors.length > errorDismissed ? runtimeErrors[runtimeErrors.length - 1] : undefined;

  // Same as the website: opening Preview on a server project starts it once; failures wait for Retry.
  useEffect(() => {
    if (status === "idle") void start();
  }, [status, start]);
  useEffect(() => setLoadError(null), [url, live.frameKey]);

  const statusText =
    status === "running" ? "Running"
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

  const running = status === "running";
  const toolbar = (
    <Row gap={2} style={{ paddingHorizontal: 8, minHeight: 48, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Row gap={6} style={{ flex: 1, minWidth: 0, paddingLeft: 4 }} testID="preview-status">
        {transitioning ? <ActivityIndicator size="small" color={c.primary} /> : status === "failed" ? <AlertTriangle size={14} color={c.danger} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: running ? c.success : c.mutedForeground }} />}
        <T variant="small" color="foreground" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }} accessibilityLiveRegion="polite">{statusText}</T>
      </Row>
      {running ? (
        <>
          <DeviceToggle device={device} onChange={setDevice} />
          <IconBtn icon={RotateCw} label="Reload live preview" size={38} onPress={live.reload} testID="button-reload-preview" />
          <View>
            <IconBtn icon={Terminal} label="Console and server logs" size={38} onPress={() => setConsoleOpen(true)} testID="button-console" />
            {errorCount ? (
              <View pointerEvents="none" style={{ position: "absolute", top: 3, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
                <Text style={{ fontSize: 10, color: "#fff", fontFamily: FONT.bold }}>{errorCount > 99 ? "99+" : errorCount}</Text>
              </View>
            ) : null}
          </View>
          <IconBtn icon={Square} label="Stop live server" size={38} onPress={live.stop} testID="button-stop-live-server" />
        </>
      ) : (
        <Btn label={status === "failed" ? "Retry" : "Start"} icon={Play} size="sm" onPress={live.start} disabled={transitioning} testID="button-start-live-server" />
      )}
      <IconBtn icon={full ? Minimize2 : Maximize2} label={full ? "Exit full screen" : "Full screen"} size={38} onPress={() => setFull(!full)} testID="button-fullscreen" />
    </Row>
  );

  const urlBar =
    running && url ? (
      <Row gap={2} style={{ paddingLeft: 12, paddingRight: 6, minHeight: 40, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface }} testID="live-url-bar">
        <Globe size={13} color={c.mutedForeground} />
        <T variant="monoSmall" color="foreground" numberOfLines={1} ellipsizeMode="middle" style={{ flex: 1, marginLeft: 6 }} accessibilityHint="Public link. Anyone with it can open this preview until the server stops." testID="live-url">
          {url.replace(/^https:\/\//, "")}
        </T>
        <IconBtn icon={Copy} label="Copy preview link" size={36} onPress={() => void copyUrl()} testID="button-copy-live-url" />
        <IconBtn icon={Share2} label="Share preview link" size={36} onPress={shareUrl} testID="button-share-live-url" />
        <IconBtn icon={ExternalLink} label="Open live preview in browser" size={36} onPress={openExternal} testID="button-open-live-preview" />
      </Row>
    ) : null;

  const stage =
    status === "running" && url ? (
      <View style={{ flex: 1, backgroundColor: device === "phone" ? c.muted : "#fff" }}>
        <DeviceFrame device={device}>
        <WebView
          key={`${live.frameKey}:${device}`}
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
          scalesPageToFit={device === "desktop"}
          injectedJavaScriptBeforeContentLoaded={LIVE_CAPTURE_JS}
          injectedJavaScript={device === "desktop" ? DESKTOP_VIEWPORT : undefined}
          onMessage={(e) => onFrameMessage(e.nativeEvent.data)}
          onShouldStartLoadWithRequest={onShouldStart}
          onError={(e) => setLoadError(e.nativeEvent.description || "The page couldn't be loaded.")}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) setLoadError(`The server answered ${e.nativeEvent.statusCode}. Check the logs, then reload.`); }}
          style={{ flex: 1, backgroundColor: "#fff" }}
          containerStyle={{ backgroundColor: "#fff" }}
        />
        </DeviceFrame>
        {latestError && !loadError ? (
          <View accessibilityRole="alert" testID="live-runtime-error" style={{ position: "absolute", left: 12, right: 12, bottom: 12, padding: 12, gap: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a("danger", 0.4), backgroundColor: c.surface }}>
            <Row center={false} gap={8}>
              <AlertTriangle size={16} color={c.danger} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="small" color="foreground" weight="semibold">{runtimeErrors.length > 1 ? `Runtime error (${runtimeErrors.length})` : "Runtime error"}</T>
                <T variant="small" color="foreground" numberOfLines={4} selectable>{latestError.message}</T>
              </View>
              <IconBtn icon={X} label="Dismiss error" size={32} onPress={() => setErrorDismissed(runtimeErrors.length)} />
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Btn label="Console" icon={Terminal} size="sm" variant="secondary" onPress={() => setConsoleOpen(true)} />
              <Btn label="Fix with AI" icon={Sparkles} size="sm" onPress={() => askAi(latestError)} testID="button-fix-with-ai" />
            </Row>
          </View>
        ) : null}
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
        {status === "failed" && (requirements?.kind === "database" || requirements?.kind === "service") ? (
          <View style={{ alignSelf: "stretch", maxWidth: 480, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <RequirementsSection compact value={requirements} />
          </View>
        ) : null}
        {status === "idle" || status === "stopped" ? <Btn label={status === "idle" ? "Start live server" : "Start again"} icon={Play} onPress={live.start} testID="button-start-live-server-body" /> : null}
        <Row style={{ flexWrap: "wrap", justifyContent: "center" }}>
          {logs ? <Btn label="Server logs" icon={Terminal} variant="secondary" size="sm" onPress={() => setLogsOpen(true)} testID="button-live-logs" /> : null}
          {status === "failed" && (logs || error) ? <Btn label="Fix with AI" icon={Sparkles} size="sm" onPress={() => askAi()} testID="button-live-fix-with-ai" /> : null}
          <Btn label="Back to code" icon={Code2} variant="secondary" size="sm" onPress={() => onTab("files")} />
        </Row>
        <T variant="tiny" style={{ textAlign: "center", maxWidth: 420 }}>{label} · {DISCLOSURE}</T>
      </ScrollView>
    );

  return (
    <View style={{ flex: 1 }} testID="preview-panel">
      {full ? null : toolbar}
      {full ? null : urlBar}
      {full ? <View style={{ flex: 1 }} /> : stage}
      {!full && status === "running" ? (
        <Pressable onPress={() => setLogsOpen(true)} accessibilityRole="button" accessibilityLabel="Server logs" style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.border }}>
          <T variant="tiny" numberOfLines={1}>
            Vercel Sandbox · public link · includes unsaved edits{live.state.files ? ` · ${live.state.files} files` : ""} · expires after 10 min · logs
          </T>
        </Pressable>
      ) : null}

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)} presentationStyle="fullScreen" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {toolbar}
          {stage}
        </View>
      </Modal>

      <Sheet
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        title="Console"
        description="Browser output from the live preview, captured on this device."
        footer={
          <Row>
            <Btn label="Server logs" icon={Terminal} variant="secondary" style={{ flex: 1 }} onPress={() => { setConsoleOpen(false); setLogsOpen(true); }} />
            <Btn label="Clear" variant="secondary" style={{ flex: 1 }} onPress={resetCapture} />
          </Row>
        }
      >
        {entries.length === 0 ? (
          <T variant="small">No console output yet.</T>
        ) : (
          <View testID="live-console-log" style={{ borderRadius: RADIUS.md, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }}>
            {entries.map((l, i) => (
              <Text key={l.id} selectable style={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 17, color: c[LEVEL_COLOR[l.level]], paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: l.level === "error" ? a("danger", 0.06) : l.level === "warn" ? a("warning", 0.06) : "transparent" }}>
                {l.text}
              </Text>
            ))}
          </View>
        )}
      </Sheet>

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
