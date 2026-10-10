import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Pencil, PlugZap, Star, Trash2 } from "lucide-react-native";
import { PROVIDERS } from "@/lib/ai-catalog";
import type { ProvidersResponse, PublicProvider } from "@/types/ai";
import { testProvider, updateGeminiModel, updateProvider } from "./api";
import { TestResult, type TestState } from "./test-result";
import { Badge, Btn, Card, Chip, Row, Switch, T } from "@/ui/kit";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Dl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Row center={false} gap={10}>
      <T variant="small" style={{ width: 70 }}>{label}</T>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </Row>
  );
}

export function ProviderCard({ provider: p, onChanged, onEdit, onRemove, onError, geminiModels }: { provider: PublicProvider; onChanged: (data: ProvidersResponse) => void; onEdit: () => void; onRemove: () => void; onError: (err: unknown) => void; geminiModels?: { id: string; available: boolean }[] }) {
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const platform = p.source === "platform";

  async function mutate(patch: Parameters<typeof updateProvider>[1]) {
    setBusy(true);
    try {
      onChanged(await updateProvider(p.id, patch));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  async function runTest() {
    setTest({ status: "running" });
    try {
      setTest({ status: "ok", result: await testProvider({ id: p.id }) });
    } catch (err) {
      setTest({ status: "error", error: err });
    }
  }
  async function changeGeminiModel(model: string) {
    setBusy(true);
    try {
      onChanged(await updateGeminiModel(model));
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }
  const last = test.status === "idle" ? p.lastTest : null;

  return (
    <Card testID={`card-provider-${p.id}`} style={{ gap: 12 }}>
      <Row center={false} gap={12}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            <T variant="h3">{p.label}</T>
            {p.isDefault ? <Badge label="Default" tone="primary" /> : null}
            {!p.enabled ? <Badge label="Disabled" /> : null}
            {platform ? <Badge label="Server" tone="warning" /> : null}
          </Row>
          {p.label !== PROVIDERS[p.kind].name ? <T variant="small">{PROVIDERS[p.kind].name}</T> : null}
        </View>
        {!platform ? <Switch value={p.enabled} disabled={busy} onValueChange={(enabled) => void mutate({ enabled })} label={`${p.enabled ? "Disable" : "Enable"} ${p.label}`} /> : null}
      </Row>
      <View style={{ gap: 6 }}>
        <Dl label="Model">
          {platform && p.kind === "gemini" && geminiModels?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID="select-server-gemini-model">
              {geminiModels
                .filter((m) => m.available || m.id === p.model)
                .map((m) => (
                  <Chip key={m.id} label={`${m.id}${m.id === "gemini-flash-latest" ? " (default)" : ""}`} active={m.id === p.model} onPress={() => !busy && m.id !== p.model && void changeGeminiModel(m.id)} />
                ))}
            </ScrollView>
          ) : (
            <T variant="mono" numberOfLines={1}>{p.model}</T>
          )}
        </Dl>
        <Dl label="Effort"><T variant="small" color="foreground">{p.effort}</T></Dl>
        {p.baseUrl ? <Dl label="Base URL"><T variant="monoSmall" color="foreground" numberOfLines={1}>{p.baseUrl}</T></Dl> : null}
        <Dl label="Key"><T variant="mono" testID="text-key-hint">{p.keyHint}</T></Dl>
        {last ? (
          <Dl label="Last test">
            <T variant="small" color={last.ok ? "success" : "danger"}>
              {last.ok ? `OK · ${last.latencyMs ?? "?"} ms` : (last.code ?? "Failed")} · {when(last.at)}
            </T>
          </Dl>
        ) : null}
      </View>
      {test.status !== "idle" && test.status !== "running" ? <TestResult state={test} /> : null}
      <Row gap={4} style={{ flexWrap: "wrap", marginHorizontal: -6 }}>
        <Btn label="Test" icon={PlugZap} variant="ghost" size="sm" loading={test.status === "running"} disabled={!p.enabled} onPress={() => void runTest()} testID="button-test-provider" />
        {!p.isDefault && p.enabled ? <Btn label="Make default" icon={Star} variant="ghost" size="sm" disabled={busy} onPress={() => void mutate({ makeDefault: true })} testID="button-make-default" /> : null}
        {!platform ? (
          <>
            <Btn label="Edit" icon={Pencil} variant="ghost" size="sm" onPress={onEdit} testID="button-edit-provider" />
            <Btn label="Remove" icon={Trash2} variant="ghost" size="sm" onPress={onRemove} testID="button-remove-provider" />
          </>
        ) : null}
      </Row>
    </Card>
  );
}
