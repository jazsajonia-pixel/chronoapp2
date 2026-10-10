import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, History, MessageSquareCode, MonitorSmartphone, Sparkles } from "lucide-react-native";
import { ActiveProviderLink } from "@/features/ai/active-provider";
import { recentAgentTasks, type RecentTask } from "@/features/agent/store";
import { proposalFiles } from "@/features/agent/proposal";
import { ShippedNote } from "@/features/git/shipped-note";
import { projectPath } from "@/lib/nav";
import { Btn, Card, Divider, EmptyState, Header, IconBtn, ListRow, Row, Screen, Section, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

export default function AIScreen() {
  const { c, a } = useTheme();
  const [recent, setRecent] = useState<RecentTask[]>(() => recentAgentTasks());
  useFocusEffect(useCallback(() => setRecent(recentAgentTasks()), []));
  return (
    <>
      <Header title="AI" large right={<IconBtn icon={History} label="Task history" onPress={() => router.push("/history")} testID="link-task-history-icon" />} />
      <Screen>
        <Card style={{ gap: 12, borderColor: a("primary", 0.3) }}>
          <Row gap={10}>
            <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={18} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T variant="h3">Chrono agent</T>
              <T variant="small">Plans, edits and previews inside a project. Every change is a reviewable diff.</T>
            </View>
          </Row>
          <ActiveProviderLink />
        </Card>
        <ListRow icon={MonitorSmartphone} title="Preview" subtitle="Run a recent project in the sandboxed live preview" onPress={() => router.push("/preview")} right={<ChevronRight size={16} color={c.mutedForeground} />} />
        <Section
          title="Recent agent tasks"
          action={recent.length ? <T variant="small" color="primary" weight="semibold" onPress={() => router.push("/history")} testID="link-task-history">Full history</T> : null}
        >
          {recent.length === 0 ? (
            <EmptyState icon={Sparkles} title="No tasks yet" action={<Btn label="Open a project" onPress={() => router.navigate("/projects")} />}>
              The agent works inside a project: open one and use the AI tab to ask questions or request changes.
            </EmptyState>
          ) : (
            <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
              {recent.map((r, i) => {
                const files = proposalFiles(r.task.proposal);
                const pending = files.filter((f) => f.decision === "pending").length;
                return (
                  <View key={`${r.owner}/${r.repo}/${r.task.id}`}>
                    {i ? <Divider /> : null}
                    <ListRow
                      testID={`recent-task-${r.task.id}`}
                      icon={MessageSquareCode}
                      title={r.task.title}
                      subtitle={`${r.owner}/${r.repo} · ${r.task.mode} · ${r.task.status.replace("_", " ")}`}
                      onPress={() => router.push(projectPath(r.owner, r.repo, "ai"))}
                      right={
                        <View style={{ alignItems: "flex-end", gap: 2, maxWidth: 110 }}>
                          {r.task.shipped ? <ShippedNote info={r.task.shipped} compact /> : null}
                          {pending ? <T variant="tiny" color="warning" weight="medium">{pending} to review</T> : null}
                        </View>
                      }
                    />
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      </Screen>
    </>
  );
}
