import { memo, useMemo, type ReactNode } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { marked, type Token, type Tokens } from "marked";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/**
 * Safe Markdown for model output, rendered with native components: raw HTML is shown as text,
 * only http(s)/mailto links are opened (in the system browser), and images are shown as links.
 */
const SAFE_URL = /^(https?:|mailto:)/i;

function open(href: string) {
  if (SAFE_URL.test(href)) void Linking.openURL(href).catch(() => {});
}

function useStyles() {
  const { c, a } = useTheme();
  return {
    c,
    a,
    body: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 22, color: c.foreground },
    code: { fontFamily: FONT.mono, fontSize: 13, color: c.foreground, backgroundColor: c.muted },
  };
}

function Inline({ tokens }: { tokens: Token[] | undefined }): ReactNode {
  const s = useStyles();
  if (!tokens) return null;
  return tokens.map((t, i) => {
    switch (t.type) {
      case "strong":
        return <Text key={i} style={{ fontFamily: FONT.semibold }}><Inline tokens={(t as Tokens.Strong).tokens} /></Text>;
      case "em":
        return <Text key={i} style={{ fontStyle: "italic" }}><Inline tokens={(t as Tokens.Em).tokens} /></Text>;
      case "del":
        return <Text key={i} style={{ textDecorationLine: "line-through" }}><Inline tokens={(t as Tokens.Del).tokens} /></Text>;
      case "codespan":
        return <Text key={i} style={s.code}>{` ${decode((t as Tokens.Codespan).text)} `}</Text>;
      case "link": {
        const l = t as Tokens.Link;
        return <Text key={i} style={{ color: s.c.primary, textDecorationLine: "underline" }} onPress={() => open(l.href)} accessibilityRole="link"><Inline tokens={l.tokens} /></Text>;
      }
      case "image": {
        const im = t as Tokens.Image;
        return <Text key={i} style={{ color: s.c.primary }} onPress={() => open(im.href)}>[image: {im.text || "link"}]</Text>;
      }
      case "br":
        return <Text key={i}>{"\n"}</Text>;
      case "text": {
        const tx = t as Tokens.Text;
        return tx.tokens ? <Inline key={i} tokens={tx.tokens} /> : <Text key={i}>{decode(tx.text)}</Text>;
      }
      case "escape":
        return <Text key={i}>{(t as Tokens.Escape).text}</Text>;
      case "html":
        return <Text key={i}>{(t as Tokens.HTML).text}</Text>;
      default:
        return <Text key={i}>{"raw" in t ? String(t.raw) : ""}</Text>;
    }
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);
}

function Blocks({ tokens, tight }: { tokens: Token[]; tight?: boolean }) {
  const s = useStyles();
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case "space":
            return null;
          case "heading": {
            const h = t as Tokens.Heading;
            return <Text key={i} style={[s.body, { fontFamily: FONT.semibold, fontSize: h.depth <= 2 ? 16 : 15, marginTop: 4 }]}><Inline tokens={h.tokens} /></Text>;
          }
          case "paragraph":
            return <Text key={i} style={s.body} selectable><Inline tokens={(t as Tokens.Paragraph).tokens} /></Text>;
          case "text": {
            const tx = t as Tokens.Text;
            return <Text key={i} style={s.body} selectable>{tx.tokens ? <Inline tokens={tx.tokens} /> : decode(tx.text)}</Text>;
          }
          case "code": {
            const cd = t as Tokens.Code;
            return (
              <View key={i} style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: s.c.border, backgroundColor: s.c.muted, overflow: "hidden" }}>
                {cd.lang ? <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: s.c.mutedForeground, paddingHorizontal: 10, paddingTop: 6 }}>{cd.lang}</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10 }}>
                  <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 18, color: s.c.foreground }}>{cd.text}</Text>
                </ScrollView>
              </View>
            );
          }
          case "blockquote":
            return (
              <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: s.c.border, paddingLeft: 10, gap: 6 }}>
                <Blocks tokens={(t as Tokens.Blockquote).tokens} />
              </View>
            );
          case "list": {
            const l = t as Tokens.List;
            const start = typeof l.start === "number" ? l.start : 1;
            return (
              <View key={i} style={{ gap: tight || !l.loose ? 3 : 8 }}>
                {l.items.map((it, j) => (
                  <View key={j} style={{ flexDirection: "row", gap: 6, paddingLeft: 2 }}>
                    <Text style={[s.body, { minWidth: 18, color: s.c.mutedForeground }]}>{it.task ? (it.checked ? "☑" : "☐") : l.ordered ? `${start + j}.` : "•"}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Blocks tokens={it.tokens} tight />
                    </View>
                  </View>
                ))}
              </View>
            );
          }
          case "table": {
            const tb = t as Tokens.Table;
            return (
              <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ borderWidth: 1, borderColor: s.c.border, borderRadius: RADIUS.sm }}>
                  <View style={{ flexDirection: "row", backgroundColor: s.c.muted }}>
                    {tb.header.map((h, k) => (
                      <Text key={k} style={[s.body, { fontFamily: FONT.semibold, fontSize: 13, width: 140, padding: 6 }]}><Inline tokens={h.tokens} /></Text>
                    ))}
                  </View>
                  {tb.rows.map((r, k) => (
                    <View key={k} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: s.c.border }}>
                      {r.map((cell, m) => (
                        <Text key={m} style={[s.body, { fontSize: 13, width: 140, padding: 6 }]}><Inline tokens={cell.tokens} /></Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          }
          case "hr":
            return <View key={i} style={{ height: 1, backgroundColor: s.c.border, marginVertical: 4 }} />;
          case "html":
            return <Text key={i} style={[s.body, { fontFamily: FONT.mono, fontSize: 13 }]} selectable>{(t as Tokens.HTML).text}</Text>;
          default:
            return "raw" in t ? <Text key={i} style={s.body}>{String(t.raw)}</Text> : null;
        }
      })}
    </>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const tokens = useMemo(() => {
    try {
      return marked.lexer(text, { gfm: true });
    } catch {
      return [{ type: "paragraph", raw: text, text, tokens: [{ type: "text", raw: text, text }] }] as Token[];
    }
  }, [text]);
  return (
    <View style={{ gap: 8 }}>
      <Blocks tokens={tokens} />
    </View>
  );
});
