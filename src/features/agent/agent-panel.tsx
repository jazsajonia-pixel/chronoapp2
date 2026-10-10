import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, ChevronDown, Circle, Clock3, History, ImageIcon, KeyRound, Paperclip, Plus, RotateCw, Sparkles, Trash2, XCircle } from "lucide-react-native";
import { ShippedNote } from "@/features/git/shipped-note";
import { useOnline } from "@/hooks/use-online";
import { useProviders } from "@/features/ai/use-providers";
import { useWorkspace } from "@/features/workspace/context";
import { AppError, isErrorCode } from "@/lib/errors";
import { safeStorage } from "@/lib/storage";
import { on } from "@/lib/events";
import type { WorkspaceTab } from "@/lib/nav";
import { MAX_AGENT_STEPS } from "@/lib/agent-tools";
import type { AgentMode } from "@/types/agent";
import { Btn, EmptyState, ErrorState, IconBtn, Row, Sheet, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";
import { Composer, type QuickAction } from "./composer";
import { Markdown } from "./markdown";
import { PlanCard } from "./plan-card";
import { ProposalSummary, ReviewSheet } from "./proposal-review";
import { resultsById, splitUserMessage, type AgentActivityRun, type AgentTask } from "./task";
import { ToolRow } from "./tool-row";
import { useAgent, type AgentProject } from "./use-agent";
import type { AgentActivity } from "./activity";

function ActivityCard({ task, onRetry, changedFilesOverride, messageStartIndex }: { task: AgentTask; onRetry?: () => void; changedFilesOverride?: number; messageStartIndex?: number }) {
  const { c, a } = useTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activities = task.activities ?? [];
  const visible = activities.slice(-8);
  const active = visible.find((item) => item.status === "running") ?? null;
  const completedCount = activities.filter((item) => item.status === "completed").length;
  const failedCount = activities.filter((item) => item.status === "failed").length;
  const reviewedFiles = new Set(activities.filter((item) => item.tool === "read_file" && item.status === "completed" && item.target).map((item) => item.target)).size;
  const changedFiles = changedFilesOverride ?? Object.values(task.proposal).filter((file) => file.decision !== "rejected").length;
  const lastUserMessageIndex = task.messages.map((message, index) => (message.role === "user" ? index : -1)).reduce((last, index) => Math.max(last, index), 0);
  const technicalMessages = task.messages.slice(messageStartIndex ?? task.activityStartMessageIndex ?? lastUserMessageIndex);
  const validation = [...activities].reverse().find((item) => item.tool === "request_preview" && (item.status === "completed" || item.status === "failed"));
  const currentTitle = active?.title ?? (task.status === "running" ? "Thinking through your request" : task.status === "awaiting_plan" ? "Waiting for your approval" : task.status === "error" ? "Request ended with an error" : task.status === "stopped" ? "Stopped" : "Work completed");
  const results = useMemo(() => resultsById(task.messages), [task.messages]);
  const statusIcon = (item: AgentActivity) => {
    if (item.status === "running") return <ActivityIndicator size="small" color={c.primary} accessibilityLabel="In progress" />;
    if (item.status === "completed") return <CheckCircle2 size={15} color={c.success} accessibilityLabel="Completed" />;
    if (item.status === "failed") return <XCircle size={15} color={c.danger} accessibilityLabel="Failed" />;
    return <Circle size={15} color={c.mutedForeground} accessibilityLabel="Queued" />;
  };
  return (
    <View accessibilityLiveRegion="polite" testID="agent-activity-card" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12, gap: 10 }}>
      <Row gap={10}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
          {task.status === "running" ? <ActivityIndicator size="small" color={c.primary} /> : <Sparkles size={16} color={c.primary} />}
        </View>
        <View style={{ flex: 1 }}>
          <T weight="semibold" style={{ fontSize: 14 }}>{task.status === "running" ? "Working on your request" : currentTitle}</T>
          <T variant="tiny" numberOfLines={2}>{active?.detail ?? (completedCount ? `${completedCount} step${completedCount === 1 ? "" : "s"} completed` : "Keeping you updated as I work")}</T>
        </View>
      </Row>
      {visible.length ? (
        <View style={{ gap: 8, paddingLeft: 4 }}>
          {visible.map((item) => (
            <Row key={item.id} center={false} gap={10}>
              <View style={{ width: 18, alignItems: "center", paddingTop: 1 }}>{statusIcon(item)}</View>
              <View style={{ flex: 1 }}>
                <T variant="small" color={item.status === "queued" ? "mutedForeground" : "foreground"}>{item.title}</T>
                {item.detail ? <T variant="tiny" numberOfLines={1}>{item.detail}</T> : null}
              </View>
            </Row>
          ))}
        </View>
      ) : null}
      {activities.length > 0 ? (
        <Pressable onPress={() => setDetailsOpen((o) => !o)} accessibilityState={{ expanded: detailsOpen }} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 30 }}>
          <View style={{ transform: [{ rotate: detailsOpen ? "180deg" : "0deg" }] }}>
            <ChevronDown size={14} color={c.mutedForeground} />
          </View>
          <T variant="tiny" weight="medium">{detailsOpen ? "Hide technical details" : "Show technical details"}</T>
        </Pressable>
      ) : null}
      {detailsOpen ? (
        <View accessibilityLabel="Technical tool details" style={{ gap: 6 }}>
          {technicalMessages
            .flatMap((message) => (message.role === "assistant" ? (message.toolCalls ?? []) : []))
            .map((call) => (
              <ToolRow key={call.id} call={call} result={results.get(call.id)} running={task.status === "running"} />
            ))}
        </View>
      ) : null}
      <Row gap={10} style={{ flexWrap: "wrap" }}>
        {reviewedFiles ? <T variant="tiny">{reviewedFiles} file{reviewedFiles === 1 ? "" : "s"} inspected</T> : null}
        {changedFiles ? <T variant="tiny">{changedFiles} change{changedFiles === 1 ? "" : "s"} prepared</T> : null}
        {validation ? <T variant="tiny" color={validation.status === "failed" || validation.detail === "Validation found an issue" ? "warning" : "primary"}>{validation.detail}</T> : null}
        {failedCount && onRetry ? (
          <T variant="tiny" color="primary" weight="semibold" onPress={onRetry}>Retry failed step{failedCount === 1 ? "" : "s"}</T>
        ) : failedCount ? (
          <T variant="tiny" color="warning">A step needs attention</T>
        ) : null}
        <Row gap={3}>
          <Clock3 size={11} color={c.mutedForeground} />
          <T variant="tiny">Updated {new Date(task.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</T>
        </Row>
      </Row>
    </View>
  );
}

function Timeline({ task, onApprove, onRevise }: { task: AgentTask; onApprove: () => void; onRevise: (f: string) => void }) {
  const { c, a } = useTheme();
  const results = useMemo(() => resultsById(task.messages), [task.messages]);
  const planId = task.status === "awaiting_plan" ? task.pending[0]?.id : null;
  return (
    <View style={{ gap: 14 }}>
      {task.messages.map((m, i) => {
        if (m.role === "tool") return null;
        const historicalRuns: AgentActivityRun[] = (task.activityHistory ?? []).filter((run) => run.afterMessageIndex === i);
        const activityCards = historicalRuns.map((run) => {
          const historicalTask: AgentTask = { ...task, status: run.status, activities: run.activities, updatedAt: run.updatedAt, messages: task.messages.slice(run.startMessageIndex, i + 1), proposal: {} };
          return <ActivityCard key={`activity-${run.id}`} task={historicalTask} changedFilesOverride={run.changedFiles} messageStartIndex={0} />;
        });
        if (m.role === "user") {
          const { text, files } = splitUserMessage(m.content);
          return (
            <Fragment key={i}>
              <View testID="msg-user" style={{ alignSelf: "flex-end", maxWidth: "88%", borderRadius: 18, borderBottomRightRadius: 6, backgroundColor: a("primary", 0.14), paddingHorizontal: 14, paddingVertical: 10, gap: 4 }}>
                <T selectable style={{ fontSize: 15, lineHeight: 21 }}>{text}</T>
                {files.length ? (
                  <Row gap={4}>
                    <Paperclip size={11} color={c.mutedForeground} />
                    <T variant="tiny" numberOfLines={2} style={{ flexShrink: 1, fontFamily: FONT.mono }}>{files.join(", ")}</T>
                  </Row>
                ) : null}
                {m.attachments?.length ? (
                  <Row gap={4} style={{ flexWrap: "wrap" }}>
                    {m.attachments.map((at) => (
                      <Row key={at.name} gap={3} style={{ borderRadius: 10, backgroundColor: c.muted, paddingHorizontal: 6, paddingVertical: 2 }}>
                        {at.mimeType.startsWith("image/") ? <ImageIcon size={11} color={c.mutedForeground} /> : <Paperclip size={11} color={c.mutedForeground} />}
                        <T variant="tiny">{at.name}</T>
                      </Row>
                    ))}
                  </Row>
                ) : null}
              </View>
              {activityCards}
            </Fragment>
          );
        }
        const calls = m.toolCalls ?? [];
        return (
          <Fragment key={i}>
            <View testID="msg-assistant" style={{ gap: 10 }}>
              {m.content ? <Markdown text={m.content} /> : null}
              {calls.map((call) => (call.name === "propose_plan" && call.args ? <PlanCard key={call.id} call={call} result={results.get(call.id)} awaiting={call.id === planId} onApprove={onApprove} onRevise={onRevise} /> : null))}
            </View>
            {activityCards}
          </Fragment>
        );
      })}
    </View>
  );
}

function StatusLine({ task, onResume }: { task: AgentTask; onResume: () => void }) {
  const { c } = useTheme();
  if (task.status === "running") {
    const active = task.pending[0];
    return (
      <Row gap={8} testID="status-running">
        <ActivityIndicator size="small" color={c.primary} />
        <T variant="small">{active ? "Running tools…" : "Thinking…"}</T>
      </Row>
    );
  }
  if (task.status === "error" && task.error) {
    const code = isErrorCode(task.error.code) ? task.error.code : "INTERNAL";
    return <ErrorState error={new AppError(code, task.error.message)} onRetry={onResume} />;
  }
  if (task.status === "stopped" || task.status === "step_limit") {
    return (
      <Row gap={8} testID="status-stopped" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 10 }}>
        <T variant="small" style={{ flex: 1 }}>{task.status === "stopped" ? "Stopped." : `Paused after ${MAX_AGENT_STEPS} steps.`}</T>
        <Btn label="Continue" icon={RotateCw} size="sm" variant="secondary" onPress={onResume} testID="button-resume-agent" />
      </Row>
    );
  }
  return null;
}

type Prefill = { text: string; mode: AgentMode; nonce: number };

function readPrefill(storageKey: string): Prefill | null {
  const raw = safeStorage.get(`agent-prefill:${storageKey}`, "session");
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { text?: unknown; mode?: unknown };
    return typeof v.text === "string" ? { text: v.text, mode: v.mode === "ask" ? "ask" : "agent", nonce: Date.now() } : null;
  } catch {
    return null;
  }
}

export function AgentPanel({ project, onTab }: { project: AgentProject; active?: boolean; onTab: (t: WorkspaceTab) => void }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const providers = useProviders();
  const agent = useAgent(project);
  // One-shot hand-off from other tabs (e.g. Preview → "Fix with AI").
  const [prefill, setPrefill] = useState<Prefill | null>(() => readPrefill(ws.source.storageKey));
  const [mode, setMode] = useState<AgentMode>(prefill?.mode ?? agent.task?.mode ?? "agent");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const following = useRef(true);
  const task = agent.task;

  const consumePrefill = (p: Prefill | null) => {
    if (!p) return;
    safeStorage.remove(`agent-prefill:${ws.source.storageKey}`, "session");
    agent.startNew();
    setMode(p.mode);
    setPrefill(p);
  };
  useEffect(() => {
    consumePrefill(prefill);
    // The AI tab stays mounted, so later hand-offs arrive as events.
    return on("agent-prefill", (d) => {
      const key = (d as { storageKey?: string } | undefined)?.storageKey;
      if (key === ws.source.storageKey) consumePrefill(readPrefill(key));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (task && !prefill) setMode(task.mode);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the conversation as it grows.
  const size = task ? task.messages.length + Object.keys(task.proposal).length + (task.activities ?? []).length + task.status.length : 0;
  useEffect(() => {
    if (following.current) setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  }, [size]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    following.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 96;
  };

  const ready = providers.state.status === "ready" ? providers.state.data : null;
  const def = ready?.providers.find((p) => p.id === ready.defaultId) ?? null;
  const online = useOnline();
  const needsProvider = providers.state.status === "ready" && !def;
  const providerLabel = def ? `${def.label} · ${def.model}` : providers.state.status === "loading" ? "Loading provider…" : "No provider";
  const active = ws.data.active;
  const quick: QuickAction[] = [
    ...(active
      ? [
          { label: "Explain this", mode: "ask" as const, text: `Explain how @${active} works.` },
          { label: "Fix this", mode: "agent" as const, text: `Fix the bug in @${active}: ` },
          { label: "Find bugs", mode: "ask" as const, text: `Find bugs or risky code in @${active}.` },
        ]
      : []),
    { label: "Explain the project", mode: "ask", text: "Explain how this project is structured and how it works." },
    { label: "Implement…", mode: "agent", text: "Implement: " },
    { label: "Review changes", mode: "ask", text: "Review my uncommitted changes (use get_git_status with include_diff) and point out bugs or improvements." },
  ];

  const composer = (
    <Composer
      key={prefill?.nonce ?? 0}
      mode={mode}
      onModeChange={setMode}
      running={agent.running}
      disabled={needsProvider || !online}
      placeholder={!online ? "You're offline — the agent needs a connection" : task?.status === "awaiting_plan" ? "Suggest plan changes…" : mode === "ask" ? "Ask about the code…" : "Describe a change…"}
      paths={ws.paths}
      activeFile={active}
      quickActions={task ? [] : quick}
      onSend={(text, attach, uploads) => {
        following.current = true;
        void agent.send(text, { mode, attach, uploads });
      }}
      onStop={agent.stop}
      initialText={prefill?.text}
    />
  );
  const welcome = !task && !needsProvider && providers.state.status !== "error";
  const storageNote = !agent.storageOk ? <T variant="tiny" color="warning" style={{ textAlign: "center" }}>Device storage is full — task history won't survive a restart.</T> : null;

  return (
    <View style={{ flex: 1 }} testID="agent-panel">
      <Row gap={2} style={{ paddingLeft: 12, paddingRight: 4, minHeight: 46, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.push("/ai-providers")} testID="link-agent-provider" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40 }}>
          <Sparkles size={14} color={c.primary} />
          <T variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{providerLabel}</T>
        </Pressable>
        <IconBtn icon={History} label="Task history" onPress={() => setHistoryOpen(true)} testID="button-agent-history" />
        <IconBtn icon={Plus} label="New task" onPress={agent.startNew} disabled={!task} testID="button-new-task" />
      </Row>
      {welcome ? (
        <ScrollView testID="agent-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 24, gap: 18 }}>
          <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 24 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: a("primary", 0.12), alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={24} color={c.primary} />
            </View>
            <T variant="h2" style={{ textAlign: "center" }}>Ask about {project.repo}</T>
            <T variant="small" style={{ textAlign: "center", lineHeight: 20 }}>Ask answers questions. Agent inspects the repo, shows a plan, and proposes edits you review as diffs — nothing reaches GitHub until you commit.</T>
          </View>
          {composer}
          {storageNote}
        </ScrollView>
      ) : (
        <>
          <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={64} testID="agent-scroll" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}>
            {needsProvider ? (
              <EmptyState icon={KeyRound} title="Add an AI provider" action={<Btn label="Open AI providers" onPress={() => router.push("/ai-providers")} />}>
                The agent uses your default provider (OpenAI, Anthropic, Gemini, OpenRouter or compatible). Keys stay on the server.
              </EmptyState>
            ) : providers.state.status === "error" ? (
              <ErrorState error={providers.state.error} onRetry={providers.reload} />
            ) : task ? (
              <View style={{ gap: 14 }}>
                <Timeline task={task} onApprove={() => agent.approvePlan()} onRevise={agent.revisePlan} />
                {task.status === "running" || (task.activities ?? []).length > 0 ? <ActivityCard task={task} onRetry={agent.resume} /> : null}
                <StatusLine task={task} onResume={agent.resume} />
                {task.shipped ? <ShippedNote info={task.shipped} /> : null}
                {task.provider && task.status === "done" ? (
                  <T variant="tiny">
                    {task.provider.label} · {task.provider.model}
                    {task.usage.inputTokens ? ` · ${task.usage.inputTokens + task.usage.outputTokens} tokens` : ""}
                  </T>
                ) : null}
              </View>
            ) : null}
            {storageNote}
          </ScrollView>
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background, paddingTop: task && Object.keys(task.proposal).length ? 8 : 0 }}>
            {task ? (
              <View style={{ paddingHorizontal: 12 }}>
                <ProposalSummary proposal={task.proposal} onReview={() => setReviewOpen(true)} onPreview={() => onTab("preview")} />
              </View>
            ) : null}
            {composer}
          </View>
        </>
      )}
      {task ? <ReviewSheet open={reviewOpen} onOpenChange={setReviewOpen} proposal={task.proposal} onAccept={agent.accept} onReject={agent.reject} conflictsFor={agent.conflictsFor} /> : null}
      <Sheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Tasks"
        description={`Saved on this device for ${project.repo} @ ${project.branch}.`}
        footer={
          <Btn
            label="New task"
            icon={Plus}
            variant="secondary"
            onPress={() => {
              agent.startNew();
              setHistoryOpen(false);
            }}
          />
        }
      >
        {agent.tasks.length === 0 ? (
          <T variant="small">No tasks yet.</T>
        ) : (
          <View style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
            {agent.tasks.map((t, i) => (
              <Row key={t.id} gap={4} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: t.id === task?.id ? a("primary", 0.08) : "transparent" }}>
                <Pressable
                  onPress={() => {
                    agent.selectTask(t.id);
                    setHistoryOpen(false);
                  }}
                  testID={`task-${t.id}`}
                  style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}
                >
                  <T weight="medium" numberOfLines={1}>{t.title}</T>
                  <T variant="tiny">
                    {t.mode} · {t.status.replace("_", " ")} · {new Date(t.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </T>
                </Pressable>
                <IconBtn icon={Trash2} label={`Delete task ${t.title}`} size={40} onPress={() => agent.removeTask(t.id)} />
              </Row>
            ))}
          </View>
        )}
      </Sheet>
    </View>
  );
}
