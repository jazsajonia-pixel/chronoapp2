import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ChevronLeft, Download, TextSearch } from "lucide-react-native";
import { useWorkspace } from "@/features/workspace/context";
import { buildMatcher, searchContent, type FileMatches } from "./project-search";
import { Btn, EmptyState, IconBtn, Row, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const LOAD_LIMIT = 300;
const MAX_FILE_BYTES = 256 * 1024;
const SKIP = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|woff2?|ttf|otf|eot|mp[34]|mov|lock)$|(^|\/)(node_modules|dist|build|\.next)\//i;

/**
 * Search across files. Searches everything already on the device (edited, opened, cached);
 * "Load files" fetches the remaining text files from GitHub (capped) so the search is complete.
 */
export function SearchPanel({ onBack, onOpen }: { onBack: () => void; onOpen: (path: string, line: number) => void }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const [query, setQuery] = useState("");
  const [caseSensitive, setCase] = useState(false);
  const [regexp, setRegexp] = useState(false);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [version, setVersion] = useState(0);
  const candidates = useMemo(() => ws.paths.filter((p) => !SKIP.test(p) && (ws.source.baseSizes?.get(p) ?? 0) <= MAX_FILE_BYTES), [ws.paths, ws.source.baseSizes]);
  const re = buildMatcher(query, { caseSensitive, regexp });
  const { results, searched } = useMemo(() => {
    if (!re) return { results: [] as FileMatches[], searched: 0 };
    const out: FileMatches[] = [];
    let n = 0;
    for (const p of candidates) {
      const content = ws.peekBuffer(p);
      if (content === undefined) continue;
      n++;
      const hit = searchContent(p, content, re);
      if (hit) out.push(hit);
    }
    return { results: out, searched: n };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, caseSensitive, regexp, candidates, ws.data, version]);
  const notLoaded = candidates.filter((p) => ws.peekBuffer(p) === undefined);
  const loadAll = async () => {
    const queue = notLoaded.slice(0, LOAD_LIMIT);
    setLoading({ done: 0, total: queue.length });
    let done = 0;
    const worker = async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        await ws.getBase(p).catch(() => null);
        done++;
        if (done % 10 === 0) setLoading({ done, total: done + queue.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    setLoading(null);
    setVersion((v) => v + 1);
  };
  const total = results.reduce((n, r) => n + r.matches.length, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 8, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Row gap={4}>
          <IconBtn icon={ChevronLeft} label="Back to files" onPress={onBack} testID="button-search-back" />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search in files"
            placeholderTextColor={c.mutedForeground}
            accessibilityLabel="Search in files"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            testID="input-project-search"
            style={{ flex: 1, height: 40, borderRadius: RADIUS.md, backgroundColor: c.muted, paddingHorizontal: 12, color: c.foreground, fontFamily: FONT.mono, fontSize: 14 }}
          />
        </Row>
        <Row gap={6} style={{ paddingHorizontal: 6 }}>
          {[
            { on: caseSensitive, set: setCase, label: "Match case", text: "Aa" },
            { on: regexp, set: setRegexp, label: "Regular expression", text: ".*" },
          ].map((t) => (
            <Pressable key={t.label} accessibilityRole="switch" accessibilityState={{ checked: t.on }} accessibilityLabel={t.label} onPress={() => t.set((v: boolean) => !v)} style={{ height: 30, minWidth: 40, paddingHorizontal: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: t.on ? c.primary : c.border, backgroundColor: t.on ? a("primary", 0.12) : "transparent", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: FONT.monoMedium, fontSize: 12, color: t.on ? c.primary : c.mutedForeground }}>{t.text}</Text>
            </Pressable>
          ))}
          <T variant="tiny" style={{ flex: 1, textAlign: "right" }} testID="text-search-summary">
            {re ? `${total} result${total === 1 ? "" : "s"} in ${results.length} file${results.length === 1 ? "" : "s"}` : ""}
          </T>
        </Row>
      </View>
      {notLoaded.length > 0 ? (
        <Row gap={8} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surface2 }}>
          <T variant="tiny" style={{ flex: 1 }}>{loading ? `Loading files… ${loading.done}/${loading.total}` : `Searching ${searched.toLocaleString()} of ${candidates.length.toLocaleString()} files on this device.`}</T>
          <Btn label={`Load ${Math.min(notLoaded.length, LOAD_LIMIT)}`} icon={Download} size="sm" variant="secondary" loading={!!loading} onPress={() => void loadAll()} testID="button-load-all" />
        </Row>
      ) : null}
      {!query ? (
        <EmptyState icon={TextSearch} title="Search across the project">Matches in edited files include your unsaved changes.</EmptyState>
      ) : !re ? (
        <T variant="small" color="danger" style={{ padding: 16 }}>Invalid regular expression.</T>
      ) : results.length === 0 ? (
        <EmptyState title="No results" />
      ) : (
        <FlatList
          testID="list-search-results"
          data={results}
          keyExtractor={(r) => r.path}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60 }}
          renderItem={({ item: r }) => (
            <View style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text numberOfLines={1} style={{ fontFamily: FONT.monoMedium, fontSize: 12, color: c.foreground, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
                {r.path} <Text style={{ color: c.mutedForeground }}>· {r.matches.length}</Text>
              </Text>
              {r.matches.map((m) => (
                <Pressable key={m.line} onPress={() => onOpen(r.path, m.line)} style={({ pressed }) => ({ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: pressed ? c.surface2 : "transparent" })}>
                  <Text style={{ width: 34, textAlign: "right", fontFamily: FONT.mono, fontSize: 12, color: c.mutedForeground }}>{m.line}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONT.mono, fontSize: 12, color: c.mutedForeground }}>
                    {m.text.slice(0, m.start)}
                    <Text style={{ color: c.foreground, backgroundColor: a("warning", 0.3) }}>{m.text.slice(m.start, m.end)}</Text>
                    {m.text.slice(m.end)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}
