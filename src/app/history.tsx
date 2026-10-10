import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { History, Search } from "lucide-react-native";
import { deleteTask, recentAgentTasks } from "@/features/agent/store";
import { HISTORY_STATUS_LABEL, filterHistory, repoOptions, toHistoryEntry, type HistoryEntry, type HistoryStatus } from "@/features/history/history";
import { STATUS_TONE, TaskDetailSheet } from "@/features/history/task-detail";
import { ShippedNote } from "@/features/git/shipped-note";
import { timeAgo } from "@/lib/utils";
import { Badge, Btn, Chip, EmptyState, Header, Row, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

const STATUSES: (HistoryStatus | "all")[] = ["all", "needs_review", "shipped", "done", "in_progress", "failed"];

export default function HistoryScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ repo?: string }>();
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => recentAgentTasks(Infinity).map(toHistoryEntry), [version]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<HistoryStatus | "all">("all");
  const [repo, setRepo] = useState<string | null>(params.repo ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const repos = repoOptions(entries);
  const shown = filterHistory(entries, { query, status, repo });
  const open = entries.find((e) => `${e.ref.key}#${e.ref.task.id}` === openId) ?? null;

  function remove(e: HistoryEntry) {
    deleteTask(e.ref.key, e.ref.task.id);
    setOpenId(null);
    setVersion((v) => v + 1);
  }

  return (
    <>
      <Header title="Task history" back />
      {entries.length === 0 ? (
        <View style={{ flex: 1, backgroundColor: c.background }}>
          <EmptyState icon={History} title="No AI tasks on this device yet" action={<Btn label="Open a project" onPress={() => router.navigate("/projects")} />}>
            Tasks you run from a project's AI tab are kept here — prompt, files changed, result and commit/PR.
          </EmptyState>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: c.background }}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={shown}
          keyExtractor={(e) => `${e.ref.key}#${e.ref.task.id}`}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 12, gap: 8 }}>
                <Search size={16} color={c.mutedForeground} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search prompts, files, branches" placeholderTextColor={c.mutedForeground} autoCapitalize="none" autoCorrect={false} testID="input-search-history" style={{ flex: 1, color: c.foreground, fontFamily: FONT.regular, fontSize: 15 }} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {STATUSES.map((s) => (
                  <Chip key={s} label={s === "all" ? "All" : HISTORY_STATUS_LABEL[s]} active={status === s} onPress={() => setStatus(s)} />
                ))}
              </ScrollView>
              {repos.length > 1 || repo ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <Chip label="All repositories" active={!repo} onPress={() => setRepo(null)} />
                  {[...new Set([...repos, ...(repo ? [repo] : [])])].map((r) => (
                    <Chip key={r} label={r} active={repo === r} onPress={() => setRepo(r)} />
                  ))}
                </ScrollView>
              ) : null}
              <T variant="tiny">
                {shown.length} of {entries.length} task{entries.length === 1 ? "" : "s"} · stored on this device
              </T>
            </View>
          }
          ListEmptyComponent={<EmptyState title="No matching tasks">Try another filter or search.</EmptyState>}
          renderItem={({ item: e }) => {
            const accepted = e.files.filter((f) => f.decision === "accepted").length;
            return (
              <Pressable
                onPress={() => setOpenId(`${e.ref.key}#${e.ref.task.id}`)}
                testID={`history-task-${e.ref.task.id}`}
                style={({ pressed }) => ({ flexDirection: "row", gap: 12, padding: 14, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface2 : c.surface })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="h3" numberOfLines={1} style={{ fontSize: 14 }}>{e.ref.task.title}</T>
                  <T variant="monoSmall" numberOfLines={1} style={{ marginTop: 2 }}>
                    {e.ref.owner}/{e.ref.repo}@{e.ref.branch}
                  </T>
                  <T variant="tiny" style={{ marginTop: 4 }}>
                    {timeAgo(new Date(e.ref.task.updatedAt))} · {e.files.length ? `${e.files.length} file${e.files.length === 1 ? "" : "s"}${accepted ? `, ${accepted} accepted` : ""}` : e.ref.task.mode === "ask" ? "question" : "no changes"}
                  </T>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Badge label={HISTORY_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />
                  {e.ref.task.shipped ? <ShippedNote info={e.ref.task.shipped} compact /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
      <TaskDetailSheet entry={open} onOpenChange={(o) => !o && setOpenId(null)} onDelete={remove} />
    </>
  );
}
