import { useState } from "react";
import { TextInput, View } from "react-native";
import { Check, ListChecks, MessageSquareWarning } from "lucide-react-native";
import type { AgentMessage, ToolCall } from "@/types/agent";
import { Badge, Btn, Row, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/** The agent's plan. While pending, the run is paused until the user approves or asks for changes. */
export function PlanCard({ call, result, awaiting, onApprove, onRevise }: { call: ToolCall; result?: Extract<AgentMessage, { role: "tool" }>; awaiting: boolean; onApprove: () => void; onRevise: (feedback: string) => void }) {
  const { c, a } = useTheme();
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const summary = typeof call.args?.summary === "string" ? call.args.summary : "";
  const steps = Array.isArray(call.args?.steps) ? call.args.steps.filter((x): x is string => typeof x === "string") : [];
  const approved = result?.content.startsWith("The user approved");
  const rejected = result?.content.startsWith("The user did NOT");
  const fb = rejected ? /feedback: (.*?)\. Revise/s.exec(result?.content ?? "")?.[1] : null;
  return (
    <View accessibilityLabel="Plan" testID="card-plan" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: awaiting ? a("primary", 0.5) : c.border, backgroundColor: awaiting ? a("primary", 0.05) : c.surface, padding: 14, gap: 10 }}>
      <Row gap={8}>
        <ListChecks size={16} color={c.primary} />
        <T variant="h3" style={{ flex: 1, fontSize: 15 }}>Plan</T>
        {approved ? <Badge label="Approved" tone="success" icon={Check} /> : rejected ? <Badge label="Changes requested" tone="warning" /> : awaiting ? <Badge label="Waiting for you" tone="primary" /> : null}
      </Row>
      {summary ? <T variant="small" color="foreground">{summary}</T> : null}
      <View style={{ gap: 6 }}>
        {steps.map((st, i) => (
          <Row key={i} center={false} gap={8}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.muted, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              <T variant="tiny" weight="semibold" color="foreground">{i + 1}</T>
            </View>
            <T variant="small" color="foreground" style={{ flex: 1, lineHeight: 20 }}>{st}</T>
          </Row>
        ))}
      </View>
      {fb ? (
        <Row center={false} gap={6}>
          <MessageSquareWarning size={14} color={c.warning} style={{ marginTop: 2 }} />
          <T variant="small" style={{ flex: 1 }}>“{fb}”</T>
        </Row>
      ) : null}
      {awaiting ? (
        revising ? (
          <View style={{ gap: 8 }}>
            <TextInput autoFocus value={feedback} onChangeText={setFeedback} multiline placeholder="What should change in the plan?" placeholderTextColor={c.mutedForeground} testID="input-plan-feedback" textAlignVertical="top" style={{ minHeight: 76, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, padding: 10, color: c.foreground, fontFamily: FONT.regular, fontSize: 14 }} />
            <Row>
              <Btn label="Cancel" variant="secondary" onPress={() => setRevising(false)} style={{ flex: 1 }} />
              <Btn label="Send" disabled={!feedback.trim()} onPress={() => feedback.trim() && onRevise(feedback.trim())} style={{ flex: 1 }} testID="button-send-plan-feedback" />
            </Row>
          </View>
        ) : (
          <Row>
            <Btn label="Change plan" variant="secondary" onPress={() => setRevising(true)} style={{ flex: 1 }} testID="button-revise-plan" />
            <Btn label="Approve" icon={Check} onPress={onApprove} style={{ flex: 1 }} testID="button-approve-plan" />
          </Row>
        )
      ) : null}
    </View>
  );
}
