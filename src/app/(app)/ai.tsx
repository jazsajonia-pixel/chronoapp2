import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { History, MessageSquareText, MonitorSmartphone, SquarePen } from "lucide-react-native";
import { ActiveProviderLink } from "@/features/ai/active-provider";
import { recentAgentTasks, type RecentTask } from "@/features/agent/store";
import { proposalFiles } from "@/features/agent/proposal";
import { ShippedNote } from "@/features/git/shipped-note";
import { recentRepos } from "@/features/github/recent";
import { chatPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import { Btn, Divider, Header, IconBtn, ListRow, Screen, Section, T } from "@/ui/kit";

const STATUS: Record<string, string> = { done: "Done", running: "Running", awaiting_plan: "Plan waiting", error: "Error", stopped: "Stopped", idle: "Draft", step_limit: "Step limit reached" };

/** Chats: every agent conversation on this device, newest first (like a chat app's history). */
export default function ChatsScreen() {
  const [recent, setRecent] = useState<RecentTask[]>(() => recentAgentTasks(30));
  useFocusEffect(useCallback(() => setRecent(recentAgentTasks(30)), []));
  const latest = recentRepos()[0];
  const newChat = () => (latest ? router.push(chatPath(latest.owner, latest.name, { branch: latest.branch, task: "new" })) : router.navigate("/projects"));
  return (
    <>
      <Header
        title="Chats"
        large
        menu
        right={
          <>
            <IconBtn icon={History} label="Full task history" size={48} onPress={() => router.push("/history")} testID="link-task-history-icon" />
            <IconBtn icon={SquarePen} label="New chat" size={48} onPress={newChat} testID="button-chats-new" />
          </>
        }
      />
      <Screen>
        <View style={{ marginHorizontal: -16 }}>
          <ActiveProviderLink />
          <ListRow icon={MonitorSmartphone} title="Preview" subtitle="Run a recent project in the sandboxed live preview" onPress={() => router.push("/preview")} />
        </View>
        <Section title="Recent" action={recent.length ? <T variant="small" color="primary" weight="semibold" onPress={() => router.push("/history")} testID="link-task-history" suppressHighlighting>Full history</T> : null}>
          {recent.length === 0 ? (
            <View style={{ gap: 12, paddingVertical: 8 }}>
              <T variant="small">No chats yet. Chats live inside a project: open one and ask a question or describe a change.</T>
              <Btn label="Open a project" size="sm" onPress={() => router.navigate("/projects")} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : (
            <View style={{ marginHorizontal: -16 }}>
              {recent.map((r, i) => {
                const pending = proposalFiles(r.task.proposal).filter((f) => f.decision === "pending").length;
                return (
                  <View key={`${r.key}/${r.task.id}`}>
                    {i ? <Divider style={{ marginLeft: 49 }} /> : null}
                    <ListRow
                      testID={`recent-task-${r.task.id}`}
                      icon={MessageSquareText}
                      title={r.task.title}
                      subtitle={`${r.repo} · ${r.task.mode === "ask" ? "Ask" : "Agent"} · ${STATUS[r.task.status] ?? r.task.status} · ${timeAgo(new Date(r.task.updatedAt))}`}
                      onPress={() => router.push(chatPath(r.owner, r.repo, { branch: r.branch, task: r.task.id }))}
                      right={
                        r.task.shipped || pending ? (
                          <View style={{ alignItems: "flex-end", gap: 2, maxWidth: 110 }}>
                            {r.task.shipped ? <ShippedNote info={r.task.shipped} compact /> : null}
                            {pending ? <T variant="tiny" color="warning" weight="medium">{pending} to review</T> : null}
                          </View>
                        ) : undefined
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

// A crash here stays on this screen (Try again / Go home) instead of taking down the app.
export { ScreenErrorBoundary as ErrorBoundary } from "@/components/error-boundary";
