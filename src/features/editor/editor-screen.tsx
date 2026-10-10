import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { ExternalLink, FileDiff, FolderTree, MoreHorizontal, PenLine, Redo2, RotateCcw, Save, Search, Trash2, Undo2, WrapText, X, type LucideIcon } from "lucide-react-native";
import { describeError } from "@/lib/errors";
import { languageFromPath } from "@/lib/tree";
import { safeStorage } from "@/lib/storage";
import { useWorkspace } from "@/features/workspace/context";
import { useFileMarks } from "@/features/workspace/use-marks";
import { CodeEditor, type CodeEditorHandle, type HistoryInfo } from "./code-editor";
import { FindBar } from "./find-bar";
import { FilesBrowser } from "./files-browser";
import { Mark } from "./file-tree";
import { Btn, ConfirmSheet, ErrorState, PromptSheet, Row, Sheet, Skeleton, T, haptic, toast } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

type Load = { path: string; status: "loading" } | { path: string; status: "ready"; doc: string; epoch: number } | { path: string; status: "error"; error: unknown };

const SYMBOLS: { label: string; insert: string; aria?: string }[] = [
  { label: "⇥", insert: "  ", aria: "Indent" },
  ...["{", "}", "(", ")", "[", "]", "<", ">", "=", ";", ":", '"', "'", "`", "/", "|", "&", "$"].map((s) => ({ label: s, insert: s })),
];
const WRAP_KEY = "editor:wrap";
const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

function ActionButton({ label, onPress, disabled, icon: Icon, testID, primary }: { label: string; onPress: () => void; disabled?: boolean; icon: LucideIcon; testID: string; primary?: boolean }) {
  const { c } = useTheme();
  const col = primary ? c.primary : c.mutedForeground;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} testID={testID} style={({ pressed }) => ({ flex: 1, height: 52, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: RADIUS.md, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      <Icon size={19} color={col} />
      <Text style={{ fontSize: 10, fontFamily: FONT.medium, color: col }}>{label}</Text>
    </Pressable>
  );
}

function MenuItem({ icon: Icon, label, onPress, danger, testID }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean; testID: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 50, paddingHorizontal: 12, borderRadius: RADIUS.md, backgroundColor: pressed ? c.surface2 : "transparent" })}>
      <Icon size={18} color={danger ? c.danger : c.mutedForeground} />
      <T color={danger ? "danger" : "foreground"} weight="medium">{label}</T>
    </Pressable>
  );
}

/**
 * The mobile editor: open-file tabs, CodeMirror, find/replace, symbol bar, and a thumb-reachable
 * action bar (undo · redo · find · save · more). Saving writes to the local workspace — nothing
 * goes to GitHub until a commit.
 */
export function EditorScreen({ onOpenSearch, onGit, visible }: { onOpenSearch: () => void; onGit: () => void; visible: boolean }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const marks = useFileMarks();
  const active = ws.data.active;
  const editor = useRef<CodeEditorHandle>(null);
  const [load, setLoad] = useState<Load | null>(null);
  const [historyInfo, setHistory] = useState<HistoryInfo>({ canUndo: false, canRedo: false });
  const [findOpen, setFindOpen] = useState(false);
  const [findCount, setFindCount] = useState({ total: 0, current: 0 });
  const [focused, setFocused] = useState(false);
  const [wrap, setWrap] = useState(() => safeStorage.get(WRAP_KEY) !== "0");
  const [sheet, setSheet] = useState<null | "more" | "rename" | "delete" | "discard" | "close" | "drawer">(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const tabsRef = useRef<ScrollView>(null);
  const tabX = useRef(new Map<string, number>());

  // An invalidated active file (revert, agent edit, rename…) is reloaded from the workspace.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(
    () =>
      ws.editorStates.subscribe((e) => {
        if (e.kind === "clear" || e.path === activeRef.current) setTimeout(() => setReload((r) => r + 1), 0);
      }),
    [ws.editorStates],
  );

  // Load the active file's buffer (draft → saved → base).
  useEffect(() => {
    if (!active) {
      setLoad(null);
      return;
    }
    let cancelled = false;
    setLoad((l) => (l && l.path === active && l.status === "ready" ? l : { path: active, status: "loading" }));
    ws.getBuffer(active).then(
      (doc) => !cancelled && setLoad({ path: active, status: "ready", doc, epoch: ws.editorStates.epoch(active) }),
      (error: unknown) => !cancelled && setLoad({ path: active, status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reload]);

  // Debounced draft tracking (dirty dot + crash protection).
  const pending = useRef<{ path: string; doc: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushDraft = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    pending.current = null;
    if (p) ws.updateDraft(p.path, p.doc);
  }, [ws]);
  useEffect(() => () => flushDraft(), [flushDraft]);
  const onChange = useCallback(
    (path: string, doc: string) => {
      if (pending.current && pending.current.path !== path) flushDraft();
      pending.current = { path, doc };
      clearTimeout(timer.current);
      timer.current = setTimeout(flushDraft, 200);
    },
    [flushDraft],
  );

  const save = useCallback(async () => {
    if (!active || load?.status !== "ready") return;
    setSaving(true);
    try {
      const doc = await editor.current?.getDoc();
      clearTimeout(timer.current);
      pending.current = null;
      await ws.save(active, doc ?? "");
      haptic.success();
      toast("Saved to workspace", "success");
    } finally {
      setSaving(false);
    }
  }, [active, load?.status, ws]);

  // Jump to a line (from project search / agent / errors).
  useEffect(() => {
    if (ws.jump && load?.status === "ready" && ws.jump.path === load.path) {
      const line = ws.jump.line;
      setTimeout(() => editor.current?.gotoLine(line), 50);
    }
  }, [ws.jump, load]);

  // Keep the active tab visible.
  useEffect(() => {
    if (!active) return;
    const x = tabX.current.get(active);
    if (x !== undefined) tabsRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [active]);

  const onHistory = useCallback((h: HistoryInfo) => setHistory((prev) => (prev.canUndo === h.canUndo && prev.canRedo === h.canRedo ? prev : h)), []);
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setFocused(false));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!visible) editor.current?.blur();
  }, [visible]);

  const requestClose = (path: string) => {
    if (path === active) flushDraft();
    if (path in ws.data.drafts || (path === active && pending.current)) {
      setClosing(path);
      setSheet("close");
    } else ws.closeFile(path);
  };

  const dirty = !!active && active in ws.data.drafts;
  const change = active ? ws.data.changes[active] : undefined;
  const ready = load?.status === "ready" && load.path === active;
  if (!active) return null;

  return (
    <View style={{ flex: 1 }}>
      {/* Tabs */}
      <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.sidebar }}>
        <Pressable onPress={() => setSheet("drawer")} accessibilityLabel="Show files" testID="button-show-tree" style={{ width: 46, height: 42, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderRightColor: c.border }}>
          <FolderTree size={17} color={c.mutedForeground} />
        </Pressable>
        <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Open files" contentContainerStyle={{ alignItems: "stretch" }}>
          {ws.data.tabs.map((t) => {
            const sel = t === active;
            return (
              <View key={t} onLayout={(e) => tabX.current.set(t, e.nativeEvent.layout.x)} style={{ flexDirection: "row", alignItems: "center", height: 42, paddingLeft: 12, borderRightWidth: 1, borderRightColor: c.border, backgroundColor: sel ? c.background : "transparent", borderBottomWidth: 2, borderBottomColor: sel ? c.primary : "transparent" }}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  onPress={() => {
                    flushDraft();
                    ws.openFile(t);
                  }}
                  testID={`tab-file-${t}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, maxWidth: 170 }}
                >
                  <Text numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 12, color: sel ? c.foreground : c.mutedForeground, flexShrink: 1 }}>{basename(t)}</Text>
                  {t in ws.data.drafts ? <View accessibilityLabel="unsaved" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary }} /> : null}
                </Pressable>
                <Pressable onPress={() => requestClose(t)} accessibilityLabel={`Close ${basename(t)}`} testID={`button-close-tab-${t}`} hitSlop={4} style={{ width: 32, height: 40, alignItems: "center", justifyContent: "center" }}>
                  <X size={13} color={c.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
      {/* Path row */}
      <Row gap={8} style={{ paddingHorizontal: 12, height: 28, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <T variant="monoSmall" numberOfLines={1} ellipsizeMode="head" style={{ flex: 1 }} testID="text-open-path">{active}</T>
        <T variant="tiny">{languageFromPath(active)}</T>
        <Mark mark={marks.get(active)} />
      </Row>
      {findOpen && ready ? <FindBar editor={editor} count={findCount} onClose={() => setFindOpen(false)} /> : null}
      {/* Body */}
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: ready ? "flex" : "none" }}>
          <CodeEditor
            ref={editor}
            file={ready ? { path: load.path, doc: load.doc, epoch: load.epoch } : null}
            states={ws.editorStates}
            wrap={wrap}
            onChange={onChange}
            onHistory={onHistory}
            onFocusChange={setFocused}
            onSave={() => void save()}
            onFind={() => setFindOpen(true)}
            onFindCount={setFindCount}
          />
        </View>
        {load?.status === "error" && load.path === active ? (
          <View style={{ padding: 16, gap: 12 }}>
            <ErrorState error={load.error} onRetry={["BINARY_FILE", "FILE_TOO_LARGE", "NOT_FOUND"].includes(describeError(load.error).code) ? undefined : () => setReload((r) => r + 1)} />
            <Row>
              <Btn label="Close tab" variant="secondary" onPress={() => ws.closeFile(active)} style={{ flex: 1 }} />
              {ws.source.githubUrl ? <Btn label="View on GitHub" icon={ExternalLink} variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(ws.source.githubUrl!(active))} /> : null}
            </Row>
          </View>
        ) : !ready ? (
          <View style={{ padding: 16, gap: 10 }} accessibilityLabel="Loading file">
            {[70, 90, 55, 80, 40, 65, 75].map((w, i) => (
              <Skeleton key={i} height={12} width={`${w}%`} />
            ))}
          </View>
        ) : null}
      </View>
      {/* Symbol bar while typing */}
      {focused ? (
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} accessibilityLabel="Insert symbol" testID="symbol-bar" style={{ flexGrow: 0, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.sidebar }} contentContainerStyle={{ paddingHorizontal: 4, gap: 2 }}>
          {SYMBOLS.map((s) => (
            <Pressable key={s.label} accessibilityLabel={s.aria ?? `Insert ${s.insert}`} onPress={() => editor.current?.insert(s.insert)} style={({ pressed }) => ({ minWidth: 40, height: 42, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.sm, backgroundColor: pressed ? a("primary", 0.15) : "transparent" })}>
              <Text style={{ fontFamily: FONT.mono, fontSize: 17, color: c.foreground }}>{s.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {/* Action bar */}
      <View style={{ flexDirection: "row", paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>
        <ActionButton label="Undo" icon={Undo2} testID="button-undo" disabled={!ready || !historyInfo.canUndo} onPress={() => editor.current?.undo()} />
        <ActionButton label="Redo" icon={Redo2} testID="button-redo" disabled={!ready || !historyInfo.canRedo} onPress={() => editor.current?.redo()} />
        <ActionButton label="Find" icon={Search} testID="button-find" disabled={!ready} onPress={() => setFindOpen((o) => !o)} />
        <ActionButton label={saving ? "Saving" : "Save"} icon={Save} testID="button-save" primary={dirty} disabled={!ready || saving || !dirty} onPress={() => void save()} />
        <ActionButton
          label="More"
          icon={MoreHorizontal}
          testID="button-more"
          onPress={() => {
            flushDraft();
            editor.current?.blur();
            setSheet("more");
          }}
        />
      </View>

      {/* Files drawer */}
      <Sheet open={sheet === "drawer"} onClose={() => setSheet(null)} title="Files" full scroll={false}>
        <View style={{ flex: 1, marginHorizontal: -16 }}>
          <FilesBrowser
            onOpen={(p) => {
              flushDraft();
              ws.openFile(p);
              setSheet(null);
            }}
            onSearch={() => {
              setSheet(null);
              onOpenSearch();
            }}
          />
        </View>
      </Sheet>

      {/* More */}
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title={basename(active)} description={active}>
        <View>
          <MenuItem
            icon={WrapText}
            label={wrap ? "Turn off word wrap" : "Turn on word wrap"}
            testID="menu-wrap"
            onPress={() => {
              setWrap((w) => {
                safeStorage.set(WRAP_KEY, w ? "0" : "1");
                return !w;
              });
              setSheet(null);
            }}
          />
          <MenuItem icon={PenLine} label="Rename or move" testID="menu-rename" onPress={() => setSheet("rename")} />
          {change || dirty ? <MenuItem icon={FileDiff} label="Review changes" testID="menu-diff" onPress={() => { setSheet(null); onGit(); }} /> : null}
          {change || dirty ? <MenuItem icon={RotateCcw} label="Discard changes to this file" testID="menu-discard" danger onPress={() => setSheet("discard")} /> : null}
          {ws.source.githubUrl && change?.status !== "added" ? <MenuItem icon={ExternalLink} label="Open on GitHub" testID="menu-github" onPress={() => { void Linking.openURL(ws.source.githubUrl!(active)); setSheet(null); }} /> : null}
          <MenuItem icon={Trash2} label="Delete file" testID="menu-delete" danger onPress={() => setSheet("delete")} />
        </View>
      </Sheet>

      <PromptSheet
        open={sheet === "rename"}
        onClose={() => setSheet(null)}
        title="Rename or move"
        label="New path — type a folder path to move it"
        initial={active}
        confirmLabel="Rename"
        validate={(v) => (!v || v.endsWith("/") ? "Enter a file path." : null)}
        onSubmit={(to) => {
          setSheet(null);
          if (to.trim() === active) return;
          flushDraft();
          ws.rename(active, to).catch((e: unknown) => toast(e instanceof Error ? e.message : "Couldn't rename the file.", "danger"));
        }}
      />
      <ConfirmSheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title={`Delete ${basename(active)}?`}
        description={change?.status === "added" ? "This new file only exists on this device and will be removed." : "The file is removed from this workspace. The deletion is sent to GitHub only when you commit."}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setSheet(null);
          void ws.remove(active);
        }}
      />
      <ConfirmSheet
        open={sheet === "discard"}
        onClose={() => setSheet(null)}
        title="Discard changes?"
        description={change?.status === "added" ? "This new file will be removed." : "The file goes back to its content on the branch. This can't be undone."}
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          clearTimeout(timer.current);
          pending.current = null;
          setSheet(null);
          ws.revert(active);
        }}
      />
      <Sheet open={sheet === "close" && !!closing} onClose={() => setSheet(null)} title={`Save changes to ${closing ? basename(closing) : ""}?`} description="Unsaved edits are kept on this device until you save or discard them.">
        <View style={{ gap: 8 }}>
          <Btn
            label="Save and close"
            testID="button-close-save"
            onPress={async () => {
              if (!closing) return;
              const draft = closing === active ? await editor.current?.getDoc() : ws.data.drafts[closing];
              if (draft !== undefined) await ws.save(closing, draft);
              ws.closeFile(closing);
              setSheet(null);
            }}
          />
          <Btn
            label="Close, keep draft"
            variant="secondary"
            testID="button-close-keep"
            onPress={() => {
              if (closing) ws.closeFile(closing);
              setSheet(null);
            }}
          />
          <Btn
            label="Discard unsaved edits"
            variant="ghost"
            testID="button-close-discard"
            onPress={() => {
              if (!closing) return;
              ws.updateDraft(closing, ws.data.changes[closing]?.content ?? ws.peekBase(closing) ?? "");
              ws.closeFile(closing);
              setSheet(null);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}
