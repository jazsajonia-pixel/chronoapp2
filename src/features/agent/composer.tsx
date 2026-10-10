import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ArrowUp, AtSign, Paperclip, Square, X } from "lucide-react-native";
import type { AgentAttachment, AgentMode } from "@/types/agent";
import { Row, T, haptic } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";
import { PlusMenu } from "./plus-menu";

export interface QuickAction {
  label: string;
  mode: AgentMode;
  text: string;
}

const UPLOAD_MAX_BYTES = 2_000_000;
const UPLOAD_TOTAL_BYTES = 5_000_000;
const TEXT_EXT = /\.(txt|md|json|js|jsx|ts|tsx|css|html|py|sql)$/i;
const MIME_BY_EXT: Record<string, string> = { txt: "text/plain", md: "text/markdown", json: "application/json", js: "text/javascript", jsx: "text/javascript", ts: "text/typescript", tsx: "text/typescript", css: "text/css", html: "text/html", py: "text/x-python", sql: "text/x-sql" };
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Paths mentioned as @path that exist in the workspace. */
export function mentionedPaths(text: string, paths: readonly string[]): string[] {
  const set = new Set(paths);
  const out: string[] = [];
  for (const m of text.matchAll(/(?:^|\s)@([\w./\-[\]()@+]+)/g)) {
    const p = m[1]!.replace(/[.,;:!?)]+$/, "");
    if (set.has(p) && !out.includes(p)) out.push(p);
  }
  return out;
}

type Picked = { name: string; uri: string; mimeType?: string | null; size?: number | null; base64?: string | null };

export function Composer({
  mode,
  onModeChange,
  running,
  disabled,
  placeholder,
  paths,
  activeFile,
  quickActions,
  onSend,
  onStop,
  initialText = "",
}: {
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
  running: boolean;
  disabled?: boolean;
  placeholder: string;
  paths: readonly string[];
  activeFile: string | null;
  quickActions: QuickAction[];
  onSend: (text: string, attach: string[], uploads: AgentAttachment[]) => void;
  onStop: () => void;
  /** Pre-filled message (e.g. "Fix with AI" from the preview). */
  initialText?: string;
}) {
  const { c, a } = useTheme();
  const [text, setText] = useState(initialText);
  const [attachActive, setAttachActive] = useState(true);
  const [uploads, setUploads] = useState<AgentAttachment[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (!initialText) return;
    setText(initialText);
    setCaret(initialText.length);
    setTimeout(() => ref.current?.focus(), 150);
  }, [initialText]);

  // @mention autocomplete for the token under the caret.
  const token = useMemo(() => {
    const before = text.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]*)$/.exec(before);
    return m ? { query: m[1]!, start: caret - m[1]!.length - 1 } : null;
  }, [text, caret]);
  const suggestions = useMemo(() => {
    if (!token) return [];
    const q = token.query.toLowerCase();
    return paths.filter((p) => p.toLowerCase().includes(q)).sort((x, y) => x.length - y.length).slice(0, 6);
  }, [token, paths]);

  const setCursor = (pos: number) => {
    setSelection({ start: pos, end: pos });
    setCaret(pos);
    // Release the controlled selection so the user can move the cursor again.
    setTimeout(() => setSelection(undefined), 60);
  };
  function pick(path: string) {
    if (!token) return;
    const next = `${text.slice(0, token.start)}@${path} ${text.slice(caret)}`;
    setText(next);
    setCursor(token.start + path.length + 2);
  }

  async function addUploads(files: Picked[]) {
    if (!files.length) return;
    const next = [...uploads];
    const skipped: string[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const mime = f.mimeType || MIME_BY_EXT[ext] || "application/octet-stream";
      if (!IMAGE_TYPES.has(mime) && !TEXT_EXT.test(f.name) && !mime.startsWith("text/")) {
        skipped.push(`${f.name} (unsupported type)`);
        continue;
      }
      let data = f.base64 ?? null;
      let size = f.size ?? 0;
      try {
        if (!data) {
          const file = new File(f.uri);
          size = size || file.size || 0;
          if (size > UPLOAD_MAX_BYTES) {
            skipped.push(`${f.name} (too large)`);
            continue;
          }
          data = await file.base64();
        }
      } catch {
        skipped.push(`${f.name} (couldn't read)`);
        continue;
      }
      size = size || Math.floor((data.length * 3) / 4);
      if (size > UPLOAD_MAX_BYTES || next.reduce((n, x) => n + x.size, 0) + size > UPLOAD_TOTAL_BYTES) {
        skipped.push(`${f.name} (too large)`);
        continue;
      }
      next.push({ name: f.name.slice(0, 120), mimeType: mime, data, size });
    }
    if (next.length > 6) skipped.push(`${next.length - 6} older file${next.length - 6 === 1 ? "" : "s"} (max 6)`);
    setUploads(next.slice(-6));
    setUploadNote(skipped.length ? `Not attached: ${skipped.join(", ")}. Images and text files up to 2 MB each.` : null);
  }

  async function pickPhotos() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.8, base64: true, exif: false });
    if (res.canceled) return;
    await addUploads(res.assets.map((x, i) => ({ name: x.fileName ?? `image-${i + 1}.${x.mimeType === "image/png" ? "png" : "jpg"}`, uri: x.uri, mimeType: x.mimeType ?? "image/jpeg", size: x.fileSize, base64: x.base64 })));
  }
  async function pickFiles() {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: ["text/*", "application/json", "application/javascript", "image/*", "*/*"] });
    if (res.canceled) return;
    await addUploads(res.assets.map((x) => ({ name: x.name, uri: x.uri, mimeType: x.mimeType, size: x.size })));
  }

  function submit() {
    const t = text.trim();
    if (!t || running || disabled) return;
    haptic.tap();
    const attach = [...(attachActive && activeFile ? [activeFile] : []), ...mentionedPaths(t, paths)];
    onSend(t, attach, uploads);
    setText("");
    setCaret(0);
    setUploads([]);
    setUploadNote(null);
    Keyboard.dismiss();
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, gap: 6 }}>
      {!text && !running && quickActions.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Quick actions" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
          {quickActions.map((q) => (
            <Pressable
              key={q.label}
              onPress={() => {
                onModeChange(q.mode);
                setText(q.text);
                setCursor(q.text.length);
                setTimeout(() => ref.current?.focus(), 30);
              }}
              testID={`quick-${q.label.toLowerCase().replace(/\W+/g, "-")}`}
              style={({ pressed }) => ({ height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, justifyContent: "center", backgroundColor: pressed ? c.surface2 : c.surface })}
            >
              <T variant="small" color="foreground">{q.label}</T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {suggestions.length ? (
        <View accessibilityRole="list" accessibilityLabel="Mention a file" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
          {suggestions.map((p, i) => (
            <Pressable key={p} onPress={() => pick(p)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: pressed ? c.surface2 : "transparent" })}>
              <AtSign size={13} color={c.primary} />
              <T variant="monoSmall" color="foreground" numberOfLines={1} ellipsizeMode="head" style={{ flex: 1 }}>{p}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View testID="composer" style={{ borderRadius: RADIUS.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, gap: 8 }}>
        {uploads.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} testID="list-uploads" contentContainerStyle={{ gap: 6 }} accessibilityLabel="Attached files">
            {uploads.map((file, i) => (
              <Pressable key={`${file.name}-${i}`} onPress={() => setUploads((list) => list.filter((_, j) => j !== i))} accessibilityLabel={`Remove ${file.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: c.muted, maxWidth: 200 }}>
                <Paperclip size={12} color={c.mutedForeground} />
                <T variant="tiny" color="foreground" numberOfLines={1} style={{ flexShrink: 1 }}>{file.name}</T>
                <X size={12} color={c.mutedForeground} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <TextInput
          ref={ref}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => setCaret(e.nativeEvent.selection.start)}
          selection={selection}
          multiline
          placeholder={placeholder}
          placeholderTextColor={c.mutedForeground}
          editable={!disabled}
          accessibilityLabel="Message the AI"
          testID="input-agent-message"
          style={{ minHeight: 24, maxHeight: 160, color: c.foreground, fontFamily: FONT.regular, fontSize: 16, lineHeight: 22, paddingVertical: 0, paddingHorizontal: 2, textAlignVertical: "top" }}
        />
        <Row gap={6}>
          <PlusMenu onAddPhotos={() => void pickPhotos()} onAddFiles={() => void pickFiles()} disabled={disabled} />
          <View accessibilityRole="radiogroup" accessibilityLabel="Mode" style={{ flexDirection: "row", borderRadius: RADIUS.md, backgroundColor: c.muted, padding: 2 }}>
            {(["ask", "agent"] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityHint={m === "ask" ? "Read-only answers" : "Plans, then proposes edits"} onPress={() => onModeChange(m)} testID={`mode-${m}`} style={{ height: 32, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center", backgroundColor: on ? c.background : "transparent" }}>
                  <Text style={{ fontFamily: on ? FONT.semibold : FONT.medium, fontSize: 13, color: on ? (m === "agent" ? c.primary : c.foreground) : c.mutedForeground }}>{m === "ask" ? "Ask" : "Agent"}</Text>
                </Pressable>
              );
            })}
          </View>
          {activeFile ? (
            <Pressable onPress={() => setAttachActive((v) => !v)} accessibilityState={{ selected: attachActive }} accessibilityLabel={attachActive ? "Current file is attached" : "Current file not attached"} testID="toggle-attach-file" style={{ flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: attachActive ? a("primary", 0.4) : c.border, borderStyle: attachActive ? "solid" : "dashed", backgroundColor: attachActive ? a("primary", 0.08) : "transparent" }}>
              <Paperclip size={12} color={attachActive ? c.primary : c.mutedForeground} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT.mono, fontSize: 11, color: attachActive ? c.primary : c.mutedForeground, textDecorationLine: attachActive ? "none" : "line-through" }}>{activeFile.split("/").pop()}</Text>
            </Pressable>
          ) : (
            <T variant="tiny" numberOfLines={1} style={{ flexShrink: 1 }}>@ mentions files</T>
          )}
          <View style={{ flex: 1 }} />
          {running ? (
            <Pressable onPress={onStop} accessibilityLabel="Stop" testID="button-stop-agent" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
              <Square size={14} color={c.foreground} fill={c.foreground} />
            </Pressable>
          ) : (
            <Pressable onPress={submit} disabled={!text.trim() || disabled} accessibilityLabel="Send" testID="button-send-agent" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", opacity: !text.trim() || disabled ? 0.4 : 1 }}>
              <ArrowUp size={18} color={c.primaryForeground} strokeWidth={2.5} />
            </Pressable>
          )}
        </Row>
      </View>
      {uploadNote ? <T variant="tiny" color="warning" accessibilityRole="alert" testID="text-upload-note">{uploadNote}</T> : null}
    </View>
  );
}
