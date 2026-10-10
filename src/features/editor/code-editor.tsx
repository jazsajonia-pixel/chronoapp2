import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { EDITOR_HTML } from "@/generated/editor-html";
import { useTheme } from "@/ui/theme";
import type { EditorStateCache } from "./state-cache";

export interface FindOptions {
  search: string;
  replace: string;
  caseSensitive: boolean;
  regexp: boolean;
  wholeWord: boolean;
  jump?: boolean;
}

export interface CodeEditorHandle {
  undo: () => void;
  redo: () => void;
  insert: (text: string) => void;
  gotoLine: (line: number) => void;
  focus: () => void;
  blur: () => void;
  /** Latest document text (flushes the editor's debounced change first). */
  getDoc: () => Promise<string>;
  find: (q: FindOptions) => void;
  findNext: () => void;
  findPrev: () => void;
  replace: () => void;
  replaceAll: () => void;
  findClose: () => void;
}

export interface HistoryInfo {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * CodeMirror 6 — the website's editor — running inside a WebView (works with mobile keyboards,
 * selection handles and IME). One editor instance per workspace; each file keeps its own
 * EditorState (and undo history) inside the WebView, keyed by the cache epoch.
 */
export const CodeEditor = forwardRef<
  CodeEditorHandle,
  {
    /** The file to show; `doc` seeds it unless the editor has a cached state for this epoch. */
    file: { path: string; doc: string; epoch: number } | null;
    states: EditorStateCache;
    wrap: boolean;
    readOnly?: boolean;
    onChange: (path: string, doc: string) => void;
    onHistory: (h: HistoryInfo) => void;
    onFocusChange?: (focused: boolean) => void;
    onSave: () => void;
    onFind: () => void;
    onFindCount?: (c: { total: number; current: number }) => void;
  }
>(function CodeEditor({ file, states, wrap, readOnly = false, onChange, onHistory, onFocusChange, onSave, onFind, onFindCount }, ref) {
  const { dark } = useTheme();
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const queue = useRef<string[]>([]);
  const docWaiters = useRef(new Map<number, (doc: string) => void>());
  const seq = useRef(0);
  const lastDoc = useRef<{ path: string; doc: string } | null>(null);
  const cb = useRef({ onChange, onHistory, onFocusChange, onSave, onFind, onFindCount });
  cb.current = { onChange, onHistory, onFocusChange, onSave, onFind, onFindCount };

  const send = useCallback((msg: Record<string, unknown>) => {
    const json = JSON.stringify(JSON.stringify(msg));
    const js = `window.__chrono && window.__chrono(${json});true;`;
    if (ready.current && web.current) web.current.injectJavaScript(js);
    else queue.current.push(js);
  }, []);

  // Workspace invalidations (revert, rename, commit, agent edits) drop the editor's cached states.
  useEffect(
    () =>
      states.subscribe((e) => {
        if (e.kind === "clear") send({ type: "clear" });
        else send({ type: "invalidate", paths: [e.path] });
      }),
    [states, send],
  );

  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!file) return;
    const key = `${file.path}#${file.epoch}`;
    if (opened.current === key) return;
    opened.current = key;
    lastDoc.current = { path: file.path, doc: file.doc };
    send({ type: "open", path: file.path, doc: file.doc, epoch: file.epoch });
  }, [file, send]);
  useEffect(() => send({ type: "wrap", value: wrap }), [wrap, send]);
  useEffect(() => send({ type: "readOnly", value: readOnly }), [readOnly, send]);
  useEffect(() => send({ type: "theme", value: dark ? "dark" : "light" }), [dark, send]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(e.nativeEvent.data) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (m.type) {
      case "ready":
        ready.current = true;
        for (const js of queue.current.splice(0)) web.current?.injectJavaScript(js);
        return;
      case "change":
        lastDoc.current = { path: String(m.path), doc: String(m.doc) };
        cb.current.onChange(String(m.path), String(m.doc));
        return;
      case "history":
        cb.current.onHistory({ canUndo: !!m.canUndo, canRedo: !!m.canRedo });
        return;
      case "focus":
        cb.current.onFocusChange?.(!!m.focused);
        return;
      case "save":
        cb.current.onSave();
        return;
      case "find":
        cb.current.onFind();
        return;
      case "findCount":
        cb.current.onFindCount?.({ total: Number(m.total) || 0, current: Number(m.current) || 0 });
        return;
      case "doc": {
        const w = docWaiters.current.get(Number(m.id));
        docWaiters.current.delete(Number(m.id));
        if (typeof m.path === "string") lastDoc.current = { path: m.path, doc: String(m.doc) };
        w?.(String(m.doc ?? ""));
        return;
      }
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      undo: () => send({ type: "undo" }),
      redo: () => send({ type: "redo" }),
      insert: (text) => send({ type: "insert", text }),
      gotoLine: (line) => send({ type: "gotoLine", line }),
      focus: () => send({ type: "focus" }),
      blur: () => send({ type: "blur" }),
      getDoc: () =>
        new Promise<string>((resolve) => {
          const id = ++seq.current;
          const fallback = setTimeout(() => {
            if (!docWaiters.current.has(id)) return;
            docWaiters.current.delete(id);
            resolve(lastDoc.current?.doc ?? "");
          }, 1500);
          docWaiters.current.set(id, (d) => {
            clearTimeout(fallback);
            resolve(d);
          });
          send({ type: "getDoc", id });
        }),
      find: (q) => send({ type: "find", ...q }),
      findNext: () => send({ type: "findNext" }),
      findPrev: () => send({ type: "findPrev" }),
      replace: () => send({ type: "replace" }),
      replaceAll: () => send({ type: "replaceAll" }),
      findClose: () => send({ type: "findClose" }),
    }),
    [send],
  );

  return (
    <View style={{ flex: 1 }} testID="code-editor">
      <WebView
        ref={web}
        source={{ html: EDITOR_HTML, baseUrl: "https://editor.chrono.invalid/" }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        hideKeyboardAccessoryView
        keyboardDisplayRequiresUserAction={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        allowFileAccess={false}
        textInteractionEnabled
        onShouldStartLoadWithRequest={(r) => r.url.startsWith("https://editor.chrono.invalid/") || r.url.startsWith("about:")}
        onContentProcessDidTerminate={() => {
          ready.current = false;
          opened.current = null;
          web.current?.reload();
        }}
        onRenderProcessGone={() => {
          ready.current = false;
          opened.current = null;
          web.current?.reload();
        }}
        onLoadStart={() => {
          ready.current = false;
        }}
        onLoadEnd={() => {
          // Re-open the current file after a (re)load; the "ready" message flushes the queue.
          if (file && opened.current === null) {
            opened.current = `${file.path}#${file.epoch}`;
            send({ type: "theme", value: dark ? "dark" : "light" });
            send({ type: "wrap", value: wrap });
            send({ type: "open", path: file.path, doc: lastDoc.current?.path === file.path ? lastDoc.current.doc : file.doc, epoch: file.epoch });
          }
        }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        containerStyle={{ backgroundColor: "transparent" }}
      />
    </View>
  );
});
