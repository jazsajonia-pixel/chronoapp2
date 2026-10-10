import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ChevronDown, Code2, Info, Maximize2, Minimize2, Monitor, RotateCw, ServerOff, Smartphone, Sparkles, Terminal, X } from "lucide-react-native";
import { useWorkspace } from "@/features/workspace/context";
import { safeStorage } from "@/lib/storage";
import { emit } from "@/lib/events";
import type { WorkspaceTab } from "@/lib/nav";
import { Btn, IconBtn, Row, Sheet, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme, type ColorName } from "@/ui/theme";
import { usePreview, type ConsoleEntry, type RuntimeError } from "./use-preview";

type Device = "fit" | "phone" | "desktop";
const BASE_URL = "https://preview.chrono.invalid/";

const LEVEL_COLOR: Record<ConsoleEntry["level"], ColorName> = { log: "foreground", debug: "mutedForeground", info: "primary", warn: "warning", error: "danger" };

/** Hand a prompt to the AI tab (read once by the agent composer). */
export function prefillAgent(storageKey: string, text: string, mode: "ask" | "agent") {
  safeStorage.set(`agent-prefill:${storageKey}`, JSON.stringify({ text, mode }), "session");
  emit("agent-prefill", { storageKey });
}

/** Desktop mode: lay the page out at 1280px and let the WebView scale it down to fit. */
const DESKTOP_VIEWPORT = `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';(document.head||document.documentElement).appendChild(m);}m.content='width=1280';}catch(e){}})();true;`;

function ErrorCard({ title, message, file, line, frame, onOpen, onAskAi }: { title: string; message: string; file: string | null; line: number | null; frame: string | null; onOpen?: () => void; onAskAi: () => void }) {
  const { c, a } = useTheme();
  return (
    <View accessibilityRole="alert" testID="preview-error" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a("danger", 0.4), backgroundColor: c.surface, padding: 14, gap: 10, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 }}>
      <Row center={false} gap={10}>
        <AlertTriangle size={18} color={c.danger} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="h3" style={{ fontSize: 15 }}>{title}</T>
          <T variant="small" color="foreground" selectable>{message}</T>
          {file ? (
            <T variant="monoSmall">
              {file}
              {line ? `:${line}` : ""}
            </T>
          ) : null}
        </View>
      </Row>
      {frame ? (
        <ScrollView horizontal style={{ maxHeight: 160, borderRadius: RADIUS.sm, backgroundColor: c.background }} contentContainerStyle={{ padding: 8 }}>
          <Text selectable style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: 16, color: c.foreground }}>{frame}</Text>
        </ScrollView>
      ) : null}
      <Row style={{ justifyContent: "space-between" }}>
        {file && onOpen ? <Btn label="Open file" icon={Code2} variant="secondary" size="sm" onPress={onOpen} testID="button-open-error-file" /> : <View />}
        <Btn label="Fix with AI" icon={Sparkles} size="sm" onPress={onAskAi} testID="button-fix-with-ai" />
      </Row>
    </View>
  );
}

function Frame({ html, frameKey, device, onMessage, title }: { html: string; frameKey: number; device: Device; onMessage: (raw: string) => void; title: string }) {
  const { c } = useTheme();
  const onShouldStart = (req: ShouldStartLoadRequest) => {
    // Sub-frames, the srcdoc itself and in-page anchors stay; the app can't navigate this screen elsewhere.
    if (req.isTopFrame === false) return true;
    if (req.url.startsWith(BASE_URL) || req.url.startsWith("about:") || req.url.startsWith("data:") || req.url.startsWith("blob:")) return true;
    if (/^(https?|mailto|tel):/i.test(req.url)) void Linking.openURL(req.url).catch(() => {});
    return false;
  };
  const view = (
    <WebView
      key={`${frameKey}:${device}`}
      testID="preview-frame"
      accessibilityLabel={title}
      source={{ html, baseUrl: BASE_URL }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      incognito
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      allowFileAccess={false}
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      scalesPageToFit={device === "desktop"}
      injectedJavaScript={device === "desktop" ? DESKTOP_VIEWPORT : undefined}
      onShouldStartLoadWithRequest={onShouldStart}
      onMessage={(e: WebViewMessageEvent) => onMessage(e.nativeEvent.data)}
      style={{ flex: 1, backgroundColor: "#fff" }}
      containerStyle={{ backgroundColor: "#fff" }}
    />
  );
  if (device === "phone") {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: c.muted }}>
        <View style={{ flex: 1, width: 390, maxWidth: "94%", borderRadius: 26, borderWidth: 4, borderColor: c.foreground, overflow: "hidden", backgroundColor: "#fff" }}>{view}</View>
      </View>
    );
  }
  return view;
}

export function PreviewPanel({ owner, repo, assetUrl, onTab }: { owner: string; repo: string; active?: boolean; assetUrl?: (path: string) => string | null; onTab: (t: WorkspaceTab) => void }) {
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  const ws = useWorkspace();
  const p = usePreview({ assetUrl });
  const [device, setDevice] = useState<Device>("fit");
  const [full, setFull] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const state = p.state;
  const result = state.status === "ready" ? state.result : state.status === "building" ? state.previous : null;
  const plan = state.status === "ready" || state.status === "building" ? state.plan : state.status === "error" ? state.plan : null;
  const errorCount = p.logs.filter((l) => l.level === "error").length;
  const notes = [...(plan?.notes ?? []), ...(result?.warnings ?? [])].filter((n, i, arr) => arr.indexOf(n) === i);

  const openFile = (file: string) => {
    if (!ws.exists(file)) return;
    setFull(false);
    ws.openFile(file);
    onTab("files");
  };
  const askAi = (e: { message: string; file: string | null; line: number | null; frame?: string | null }, build: boolean) => {
    const where = e.file ? ` in @${e.file}${e.line ? ` (line ${e.line})` : ""}` : "";
    prefillAgent(ws.source.storageKey, `The preview ${build ? "fails to build" : "throws an error"}${where}:\n\n${e.message}\n\nFind the cause and fix it.`, "agent");
    setFull(false);
    onTab("ai");
  };

  if (state.status === "unsupported") {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12, alignItems: "center", flexGrow: 1, justifyContent: "center" }} testID="preview-unsupported">
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.muted, alignItems: "center", justifyContent: "center" }}>
          <ServerOff size={26} color={c.mutedForeground} />
        </View>
        <T variant="h2" style={{ textAlign: "center" }}>{state.plan.label} can't be previewed in the app</T>
        <T variant="small" style={{ textAlign: "center" }}>{state.plan.reason}</T>
        <T variant="small" style={{ textAlign: "center" }}>{state.plan.hint}</T>
        <T variant="tiny" style={{ textAlign: "center" }}>Supported today: HTML/CSS/JS, Vite (React, Preact, TypeScript), Create React App.</T>
        <Row style={{ marginTop: 8 }}>
          <Btn label="Back to code" icon={Code2} variant="secondary" onPress={() => onTab("files")} />
          <Btn label="Check again" icon={RotateCw} variant="secondary" onPress={p.rebuild} />
        </Row>
      </ScrollView>
    );
  }

  const runtimeError: RuntimeError | undefined = p.errors[0];
  const busy = state.status === "analyzing" || state.status === "building";
  const statusText = state.status === "analyzing" ? "Detecting project…" : state.status === "building" ? "Building…" : state.status === "error" ? "Build failed" : runtimeError ? "Runtime error" : p.booted ? (plan?.label ?? "Ready") : "Starting…";
  const dot: ColorName = state.status === "error" || runtimeError ? "danger" : p.booted ? "success" : "warning";

  const toolbar = (
    <Row gap={2} style={{ paddingHorizontal: 8, minHeight: 48, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Row gap={6} style={{ flex: 1, minWidth: 0, paddingLeft: 4 }} testID="preview-status">
        {busy ? <ActivityIndicator size="small" color={c.primary} /> : state.status === "error" || runtimeError ? <AlertTriangle size={14} color={c.danger} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c[dot] }} />}
        <T variant="small" color="foreground" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{statusText}</T>
        {plan && plan.pages.length > 1 ? (
          <Pressable onPress={() => setPageOpen(true)} testID="select-preview-page" style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, height: 28, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: c.border, maxWidth: 130 }}>
            <T variant="monoSmall" numberOfLines={1} style={{ flexShrink: 1 }}>{(p.page ?? plan.html).slice(plan.root.length)}</T>
            <ChevronDown size={12} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </Row>
      <View accessibilityRole="radiogroup" accessibilityLabel="Viewport" style={{ flexDirection: "row", borderRadius: RADIUS.sm, backgroundColor: c.muted, padding: 2 }}>
        {([["fit", "Fit", Maximize2], ["phone", "Phone", Smartphone], ["desktop", "Desktop", Monitor]] as const).map(([d, label, Icon]) => {
          const on = device === d;
          return (
            <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => setDevice(d)} testID={`device-${d}`} style={{ width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.background : "transparent" }}>
              <Icon size={14} color={on ? c.foreground : c.mutedForeground} />
            </Pressable>
          );
        })}
      </View>
      <IconBtn icon={RotateCw} label="Rebuild and reload" size={38} onPress={p.rebuild} testID="button-reload-preview" />
      <View>
        <IconBtn icon={Terminal} label="Console" size={38} onPress={() => setConsoleOpen(true)} testID="button-console" />
        {errorCount ? (
          <View pointerEvents="none" style={{ position: "absolute", top: 3, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
            <Text style={{ fontSize: 10, color: "#fff", fontFamily: FONT.bold }}>{errorCount}</Text>
          </View>
        ) : null}
      </View>
      <IconBtn icon={full ? Minimize2 : Maximize2} label={full ? "Exit full screen" : "Full screen"} size={38} onPress={() => setFull(!full)} testID="button-fullscreen" />
      {full ? <IconBtn icon={Code2} label="Back to code" size={38} onPress={() => { setFull(false); onTab("files"); }} /> : null}
    </Row>
  );

  const stage = (
    <View style={{ flex: 1, backgroundColor: c.muted }}>
      {state.status === "error" ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <ErrorCard title="The preview couldn't be built" message={state.error.message} file={state.error.file} line={state.error.line} frame={state.error.frame} onOpen={state.error.file ? () => openFile(state.error.file!) : undefined} onAskAi={() => askAi(state.error, true)} />
          <T variant="small" style={{ textAlign: "center" }}>Fix the file and the preview rebuilds automatically.</T>
        </ScrollView>
      ) : result ? (
        <Frame html={result.html} frameKey={p.frameKey} device={device} onMessage={p.onFrameMessage} title={`Preview of ${repo}`} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator color={c.primary} />
          <T variant="small">{state.status === "analyzing" ? "Detecting project…" : "Building preview…"}</T>
        </View>
      )}
      {state.status === "building" && result ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: a("primary", 0.6) }} /> : null}
      {runtimeError && state.status !== "error" ? (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <ErrorCard
            title={p.errors.length > 1 ? `Runtime error (${p.errors.length})` : "Runtime error"}
            message={runtimeError.message}
            file={runtimeError.file}
            line={runtimeError.line}
            frame={runtimeError.frame}
            onOpen={runtimeError.file ? () => openFile(runtimeError.file!) : undefined}
            onAskAi={() => askAi(runtimeError, false)}
          />
          <View style={{ position: "absolute", top: 6, right: 6 }}>
            <IconBtn icon={X} label="Dismiss error" size={32} onPress={p.dismissErrors} />
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }} testID="preview-panel">
      {full ? null : toolbar}
      {!full && notes.length ? (
        <Pressable onPress={() => setNotesOpen(!notesOpen)} accessibilityState={{ expanded: notesOpen }} testID="preview-notes" style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: a("primary", 0.06), borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Info size={14} color={c.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, gap: 3 }}>
            {notesOpen ? notes.map((n) => <T key={n} variant="tiny" color="foreground">• {n}</T>) : <T variant="tiny" numberOfLines={1}>{notes.length} note{notes.length === 1 ? "" : "s"} · {notes[0]}</T>}
          </View>
        </Pressable>
      ) : null}
      {full ? <View style={{ flex: 1 }} /> : stage}
      {!full && result ? (
        <T variant="tiny" numberOfLines={1} style={{ paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border }}>
          Sandboxed · includes unsaved edits · {result.modules} modules{result.packages.length ? ` · ${result.packages.length} npm packages via esm.sh` : ""} · {result.durationMs} ms
        </T>
      ) : null}

      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)} presentationStyle="fullScreen" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
          {toolbar}
          {stage}
        </View>
      </Modal>

      <Sheet open={pageOpen} onClose={() => setPageOpen(false)} title="Page">
        {plan?.pages.map((pg) => {
          const on = (p.page ?? plan.html) === pg;
          return (
            <Pressable key={pg} onPress={() => { p.goToPage(pg); setPageOpen(false); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: RADIUS.md, backgroundColor: on ? a("primary", 0.1) : "transparent" }}>
              <T variant="mono" color={on ? "primary" : "foreground"}>{pg.slice(plan.root.length)}</T>
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet
        open={consoleOpen}
        onClose={() => setConsoleOpen(false)}
        title="Console"
        description="Output from the preview (sandboxed)."
        footer={
          <Row>
            <Btn label="Clear" variant="secondary" onPress={p.clearLogs} style={{ flex: 1 }} />
            <Btn label="Reload" icon={RotateCw} variant="secondary" style={{ flex: 1 }} onPress={() => { setConsoleOpen(false); p.reload(); }} />
          </Row>
        }
      >
        {p.logs.length === 0 ? (
          <T variant="small">No console output yet.</T>
        ) : (
          <View testID="console-log" style={{ borderRadius: RADIUS.md, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }}>
            {p.logs.map((l, i) => (
              <Text key={l.id} selectable style={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 17, color: c[LEVEL_COLOR[l.level]], paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: l.level === "error" ? a("danger", 0.06) : l.level === "warn" ? a("warning", 0.06) : "transparent" }}>
                {l.text}
              </Text>
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}
