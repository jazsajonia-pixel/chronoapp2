/**
 * Chrono native editor host — CodeMirror 6 running inside a WebView (same editor + extensions as
 * the website). One EditorView; each file keeps its own EditorState (and undo history) here, so
 * switching files never loses history. Protocol (JSON strings):
 *   RN → editor: open | invalidate | clear | undo | redo | insert | gotoLine | focus | blur | wrap |
 *                readOnly | theme | getDoc | find | findNext | findPrev | replace | replaceAll | findClose
 *   editor → RN: ready | change | history | focus | save | doc | findCount
 */
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { SearchQuery, findNext, findPrevious, highlightSelectionMatches, replaceAll, replaceNext, search, searchKeymap, setSearchQuery, getSearchQuery } from "@codemirror/search";
import { editorTheme, syntaxTheme } from "./theme";
import { loadLanguage } from "./languages";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(msg: string): void };
    __chrono?: (raw: string) => void;
  }
}

const post = (m: Record<string, unknown>) => window.ReactNativeWebView?.postMessage(JSON.stringify(m));

const languageSlot = new Compartment();
const wrapSlot = new Compartment();
const readOnlySlot = new Compartment();
let wrap = true;
let readOnly = false;
let currentPath: string | null = null;
let changeTimer: ReturnType<typeof setTimeout> | undefined;
const states = new Map<string, { state: EditorState; epoch: number }>();
let currentEpoch = 0;

const hiddenSearchPanel = () => {
  const dom = document.createElement("div");
  dom.hidden = true;
  return { dom, top: true };
};

function flushChange() {
  if (changeTimer === undefined) return;
  clearTimeout(changeTimer);
  changeTimer = undefined;
  if (currentPath) post({ type: "change", path: currentPath, doc: view.state.doc.toString() });
}

function historyInfo(s: EditorState) {
  post({ type: "history", canUndo: undoDepth(s) > 0, canRedo: redoDepth(s) > 0 });
}

function extensions(): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ createPanel: hiddenSearchPanel }),
    keymap.of([
      { key: "Mod-s", preventDefault: true, run: () => (flushChange(), post({ type: "save" }), true) },
      { key: "Mod-f", preventDefault: true, run: () => (post({ type: "find" }), true) },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap.filter((k) => k.key !== "Mod-f"),
      indentWithTab,
    ]),
    EditorState.tabSize.of(2),
    editorTheme,
    syntaxTheme,
    languageSlot.of([]),
    wrapSlot.of(wrap ? EditorView.lineWrapping : []),
    readOnlySlot.of(EditorState.readOnly.of(readOnly)),
    EditorView.contentAttributes.of({ autocapitalize: "off", autocorrect: "off", spellcheck: "false", "aria-label": "Code editor" }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        // Debounced: the bridge is async; full text keeps both sides trivially consistent.
        clearTimeout(changeTimer);
        changeTimer = setTimeout(flushChange, 120);
        if (getSearchQuery(u.state).search) countMatches();
      }
      if (u.docChanged || u.transactions.length) historyInfo(u.state);
      if (u.focusChanged) post({ type: "focus", focused: u.view.hasFocus });
    }),
  ];
}

const view = new EditorView({ parent: document.getElementById("editor")! });

function countMatches() {
  const q = getSearchQuery(view.state);
  if (!q.search || !q.valid) return post({ type: "findCount", total: 0, current: 0 });
  const cur = q.getCursor(view.state);
  const sel = view.state.selection.main;
  let total = 0;
  let current = 0;
  for (let r = cur.next(); !r.done && total < 5000; r = cur.next()) {
    total += 1;
    if (r.value.from === sel.from && r.value.to === sel.to) current = total;
  }
  post({ type: "findCount", total, current });
}

function open(m: { path: string; doc: string; epoch: number }) {
  flushChange();
  if (currentPath) states.set(currentPath, { state: view.state, epoch: currentEpoch });
  const cached = states.get(m.path);
  // A cached state is only valid for the same content epoch (external writes bump the epoch).
  const state = cached && cached.epoch === m.epoch ? cached.state : EditorState.create({ doc: m.doc, extensions: extensions() });
  view.setState(state);
  currentPath = m.path;
  currentEpoch = m.epoch;
  view.dispatch({ effects: [wrapSlot.reconfigure(wrap ? EditorView.lineWrapping : []), readOnlySlot.reconfigure(EditorState.readOnly.of(readOnly))] });
  historyInfo(view.state);
  const path = m.path;
  loadLanguage(path).then(
    (lang) => {
      if (lang && currentPath === path) view.dispatch({ effects: languageSlot.reconfigure(lang) });
    },
    () => {},
  );
}

type Msg = { type: string; [k: string]: unknown };

window.__chrono = (raw: string) => {
  let m: Msg;
  try {
    m = JSON.parse(raw) as Msg;
  } catch {
    return;
  }
  switch (m.type) {
    case "open":
      return open(m as unknown as { path: string; doc: string; epoch: number });
    case "invalidate":
      for (const p of m.paths as string[]) states.delete(p);
      return;
    case "clear":
      states.clear();
      return;
    case "undo":
      undo(view);
      return;
    case "redo":
      redo(view);
      return;
    case "insert":
      view.dispatch(view.state.replaceSelection(String(m.text)), { scrollIntoView: true, userEvent: "input.type" });
      view.focus();
      return;
    case "gotoLine": {
      const l = view.state.doc.line(Math.max(1, Math.min(Number(m.line), view.state.doc.lines)));
      view.dispatch({ selection: { anchor: l.from, head: l.to }, effects: EditorView.scrollIntoView(l.from, { y: "center" }) });
      return;
    }
    case "focus":
      view.focus();
      return;
    case "blur":
      view.contentDOM.blur();
      return;
    case "wrap":
      wrap = !!m.value;
      view.dispatch({ effects: wrapSlot.reconfigure(wrap ? EditorView.lineWrapping : []) });
      return;
    case "readOnly":
      readOnly = !!m.value;
      view.dispatch({ effects: readOnlySlot.reconfigure(EditorState.readOnly.of(readOnly)) });
      return;
    case "theme":
      document.documentElement.classList.toggle("dark", m.value === "dark");
      document.documentElement.style.fontSize = "";
      return;
    case "fontSize":
      document.documentElement.style.setProperty("--fs", `${Number(m.value)}px`);
      (view.dom as HTMLElement).style.fontSize = `${Number(m.value)}px`;
      return;
    case "getDoc":
      flushChange();
      post({ type: "doc", id: m.id, path: currentPath, doc: view.state.doc.toString() });
      return;
    case "find": {
      const q = new SearchQuery({ search: String(m.search ?? ""), replace: String(m.replace ?? ""), caseSensitive: !!m.caseSensitive, regexp: !!m.regexp, wholeWord: !!m.wholeWord });
      view.dispatch({ effects: setSearchQuery.of(q) });
      if (m.jump && q.search) findNext(view);
      countMatches();
      return;
    }
    case "findNext":
      findNext(view);
      countMatches();
      return;
    case "findPrev":
      findPrevious(view);
      countMatches();
      return;
    case "replace":
      replaceNext(view);
      countMatches();
      return;
    case "replaceAll":
      replaceAll(view);
      countMatches();
      return;
    case "findClose":
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
      return;
  }
};

post({ type: "ready" });
