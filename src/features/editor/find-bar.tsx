import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown, ChevronUp, Replace, X } from "lucide-react-native";
import type { CodeEditorHandle } from "./code-editor";
import { IconBtn, Row, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const MAX_COUNT = 999;

function Toggle({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: string }) {
  const { c, a } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={{ height: 30, minWidth: 38, paddingHorizontal: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? a("primary", 0.12) : "transparent", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontFamily: FONT.monoMedium, fontSize: 12, color: on ? c.primary : c.mutedForeground }}>{children}</Text>
    </Pressable>
  );
}

function isValidRegex(s: string) {
  try {
    new RegExp(s);
    return true;
  } catch {
    return false;
  }
}

/** Mobile find / replace bar driving @codemirror/search inside the editor. */
export function FindBar({ editor, count, onClose, readOnly }: { editor: React.RefObject<CodeEditorHandle | null>; count: { total: number; current: number }; onClose: () => void; readOnly?: boolean }) {
  const { c } = useTheme();
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCase] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const first = useRef(true);
  const invalidRegex = regexp && search !== "" && !isValidRegex(search);

  useEffect(() => {
    editor.current?.find({ search, replace, caseSensitive, regexp, wholeWord, jump: !first.current });
    first.current = false;
  }, [search, replace, caseSensitive, regexp, wholeWord, editor]);
  useEffect(() => () => editor.current?.findClose(), [editor]);

  const label = !search ? "" : invalidRegex ? "Bad regex" : count.total === 0 ? "No results" : `${count.current || "–"}/${count.total > MAX_COUNT ? `${MAX_COUNT}+` : count.total}`;
  const input = { flex: 1, height: 38, borderRadius: RADIUS.md, backgroundColor: c.muted, paddingHorizontal: 10, color: c.foreground, fontFamily: FONT.mono, fontSize: 14 } as const;
  return (
    <View accessibilityRole="search" accessibilityLabel="Find in file" testID="find-bar" style={{ paddingHorizontal: 6, paddingVertical: 6, gap: 6, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.background }}>
      <Row gap={2}>
        {!readOnly ? <IconBtn icon={Replace} label={showReplace ? "Hide replace" : "Show replace"} size={36} color={showReplace ? "primary" : undefined} onPress={() => setShowReplace((s) => !s)} /> : null}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => editor.current?.findNext()}
            blurOnSubmit={false}
            returnKeyType="search"
            placeholder="Find"
            placeholderTextColor={c.mutedForeground}
            accessibilityLabel="Find"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            testID="input-find"
            style={[input, { paddingRight: 70 }]}
          />
          <T variant="tiny" testID="text-find-count" style={{ position: "absolute", right: 10 }} color={invalidRegex ? "danger" : "mutedForeground"}>{label}</T>
        </View>
        <IconBtn icon={ChevronUp} label="Previous match" size={36} onPress={() => editor.current?.findPrev()} />
        <IconBtn icon={ChevronDown} label="Next match" size={36} onPress={() => editor.current?.findNext()} testID="button-find-next" />
        <IconBtn icon={X} label="Close find" size={36} onPress={onClose} testID="button-close-find" />
      </Row>
      <Row gap={6} style={{ paddingHorizontal: 4 }}>
        <Toggle on={caseSensitive} onPress={() => setCase((v) => !v)} label="Match case">Aa</Toggle>
        <Toggle on={wholeWord} onPress={() => setWholeWord((v) => !v)} label="Whole word">ab</Toggle>
        <Toggle on={regexp} onPress={() => setRegexp((v) => !v)} label="Regular expression">.*</Toggle>
      </Row>
      {showReplace && !readOnly ? (
        <Row gap={6} style={{ paddingHorizontal: 4 }}>
          <TextInput value={replace} onChangeText={setReplace} onSubmitEditing={() => editor.current?.replace()} blurOnSubmit={false} placeholder="Replace" placeholderTextColor={c.mutedForeground} accessibilityLabel="Replace with" autoCapitalize="none" autoCorrect={false} spellCheck={false} testID="input-replace" style={input} />
          <Pressable disabled={!count.total} onPress={() => editor.current?.replace()} testID="button-replace" style={{ height: 38, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, justifyContent: "center", opacity: count.total ? 1 : 0.4 }}>
            <T variant="small" color="foreground" weight="medium">Replace</T>
          </Pressable>
          <Pressable disabled={!count.total} onPress={() => editor.current?.replaceAll()} testID="button-replace-all" style={{ height: 38, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, justifyContent: "center", opacity: count.total ? 1 : 0.4 }}>
            <T variant="small" color="foreground" weight="medium">All</T>
          </Pressable>
        </Row>
      ) : null}
    </View>
  );
}
