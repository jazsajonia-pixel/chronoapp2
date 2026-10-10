import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Columns2, Rows3 } from "lucide-react-native";
import { splitRows, type DiffLine, type FileDiff } from "./diff";
import { T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const SIGN: Record<DiffLine["kind"], string> = { add: "+", del: "−", context: " " };
const LINE_H = 18;

function useRowColors() {
  const { c, a } = useTheme();
  return {
    bg: { add: a("diffAdd", 0.12), del: a("diffDel", 0.12), context: "transparent" } as Record<DiffLine["kind"], string>,
    sign: { add: c.diffAdd, del: c.diffDel, context: c.mutedForeground } as Record<DiffLine["kind"], string>,
    c,
    a,
  };
}

function Hunk({ header }: { header: string }) {
  const { c, a } = useTheme();
  return (
    <Text style={{ fontFamily: FONT.mono, fontSize: 11, lineHeight: LINE_H + 2, color: c.mutedForeground, backgroundColor: a("primary", 0.06), paddingHorizontal: 8 }} numberOfLines={1}>
      {header}
    </Text>
  );
}

function Unified({ diff }: { diff: FileDiff }) {
  const { bg, sign, c } = useRowColors();
  const mono = { fontFamily: FONT.mono, fontSize: 12, lineHeight: LINE_H } as const;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator bounces={false}>
      <View style={{ minWidth: "100%" }}>
        {diff.hunks.map((h, hi) => (
          <View key={hi}>
            <Hunk header={h.header} />
            {h.lines.map((l, i) => (
              <View key={i} style={{ flexDirection: "row", backgroundColor: bg[l.kind] }} accessibilityLabel={`${l.kind === "add" ? "added: " : l.kind === "del" ? "removed: " : ""}${l.text}`}>
                <Text style={[mono, { width: 34, textAlign: "right", color: c.mutedForeground, opacity: 0.7 }]}>{l.oldNo ?? ""}</Text>
                <Text style={[mono, { width: 34, textAlign: "right", color: c.mutedForeground, opacity: 0.7 }]}>{l.newNo ?? ""}</Text>
                <Text style={[mono, { width: 18, textAlign: "center", color: sign[l.kind] }]}>{SIGN[l.kind]}</Text>
                <Text style={[mono, { color: c.foreground, paddingRight: 12 }]}>{l.text || " "}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Cell({ line, width }: { line: DiffLine | null; width: number }) {
  const { bg, c } = useRowColors();
  const mono = { fontFamily: FONT.mono, fontSize: 11, lineHeight: LINE_H } as const;
  if (!line) return <View style={{ width, backgroundColor: c.muted, opacity: 0.4 }} />;
  const no = line.kind === "add" ? line.newNo : (line.oldNo ?? line.newNo);
  return (
    <View style={{ width, flexDirection: "row", backgroundColor: bg[line.kind] }}>
      <Text style={[mono, { width: 30, textAlign: "right", color: c.mutedForeground, paddingRight: 4 }]}>{no}</Text>
      <Text style={[mono, { flex: 1, color: c.foreground }]} numberOfLines={1}>{line.text || " "}</Text>
    </View>
  );
}

function Split({ diff, width }: { diff: FileDiff; width: number }) {
  const half = Math.floor(width / 2);
  return (
    <View>
      {diff.hunks.map((h, hi) => (
        <View key={hi}>
          <Hunk header={h.header} />
          {splitRows(h).map((r, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              <Cell line={r.left && r.left.kind !== "add" ? r.left : null} width={half} />
              <Cell line={r.right && r.right.kind !== "del" ? r.right : null} width={half} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Unified on phones; side-by-side available on wider screens (tablets / landscape). */
export function DiffView({ diff }: { diff: FileDiff }) {
  const { c, a } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [boxW, setBoxW] = useState(width - 32);
  if (diff.tooLarge) return <T variant="small" style={{ padding: 12 }}>This diff is too large to show on a phone. +{diff.added} −{diff.removed} lines.</T>;
  if (diff.hunks.length === 0) return <T variant="small" style={{ padding: 12 }}>Empty file.</T>;
  const split = wide && mode === "split";
  return (
    <View testID={`diff-${diff.path}`} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      {wide ? (
        <View style={{ flexDirection: "row", gap: 4, padding: 6, justifyContent: "flex-end" }}>
          {(["unified", "split"] as const).map((m) => {
            const on = mode === m;
            const Icon = m === "unified" ? Rows3 : Columns2;
            return (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 28, borderRadius: RADIUS.sm, backgroundColor: on ? a("primary", 0.12) : "transparent" }}>
                <Icon size={13} color={on ? c.primary : c.mutedForeground} />
                <T variant="tiny" color={on ? "primary" : "mutedForeground"}>{m === "unified" ? "Unified" : "Split"}</T>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {split ? <Split diff={diff} width={boxW} /> : <Unified diff={diff} />}
    </View>
  );
}
