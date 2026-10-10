import { useEffect, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ExternalLink, Eye, EyeOff, PlugZap } from "lucide-react-native";
import { PROVIDERS, PROVIDER_KINDS } from "@/lib/ai-catalog";
import { AppError, describeError } from "@/lib/errors";
import type { ProviderEffort, ProviderKind, ProvidersResponse, PublicProvider } from "@/types/ai";
import { createProvider, testProvider, updateProvider, type TestInput } from "./api";
import { TestResult, type TestState } from "./test-result";
import { Btn, Chip, Field, IconBtn, Row, Segmented, Sheet, Switch, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/**
 * Add / edit provider sheet. The API key lives only in this component's state until it's
 * submitted (over HTTPS to the Chrono API, where it's encrypted at rest); cleared on close and
 * never written to device storage.
 */
export function ProviderForm({ open, onOpenChange, editing, storageNote, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: PublicProvider | null; storageNote: string; onSaved: (data: ProvidersResponse) => void }) {
  const { c, a } = useTheme();
  const [kind, setKind] = useState<ProviderKind>("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(PROVIDERS.openai.defaultModel);
  const [effort, setEffort] = useState<ProviderEffort>("medium");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [makeDefault, setMakeDefault] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      setShowKey(false);
      return;
    }
    const k = editing?.kind ?? "openai";
    setKind(k);
    setLabel(editing?.label ?? "");
    setModel(editing?.model ?? PROVIDERS[k].defaultModel);
    setEffort(editing?.effort ?? "medium");
    setBaseUrl(editing?.baseUrl ?? "");
    setEnabled(editing?.enabled ?? true);
    setMakeDefault(false);
    setModels([]);
    setTest({ status: "idle" });
    setError(null);
  }, [open, editing]);

  const meta = PROVIDERS[kind];
  const suggestions = Array.from(new Set([...meta.suggestedModels, ...models]));
  const keyRequired = !editing;
  const trimmedKey = apiKey.trim();
  const modelChoicesReady = Boolean(editing || trimmedKey);

  function pickKind(k: ProviderKind) {
    setKind(k);
    setModel(PROVIDERS[k].defaultModel);
    setModels([]);
    setTest({ status: "idle" });
    setError(null);
  }
  function validate(): string | null {
    if (keyRequired && !trimmedKey) return "Paste an API key.";
    if (trimmedKey && /\s/.test(trimmedKey)) return "API keys can't contain spaces.";
    if (!model.trim()) return "Choose a model.";
    if (meta.needsBaseUrl && !baseUrl.trim()) return "Enter the provider's base URL.";
    return null;
  }
  async function runTest() {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setTest({ status: "running" });
    const b = meta.needsBaseUrl ? baseUrl.trim() : null;
    const input: TestInput = editing && !trimmedKey ? { id: editing.id, model: model.trim(), ...(meta.needsBaseUrl ? { baseUrl: b } : {}) } : { kind, model: model.trim(), baseUrl: b, apiKey: trimmedKey };
    try {
      const result = await testProvider(input);
      setModels(result.models);
      setTest({ status: "ok", result });
    } catch (err) {
      setTest({ status: "error", error: err });
    }
  }
  async function save() {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setSaving(true);
    try {
      const b = meta.needsBaseUrl ? baseUrl.trim() : null;
      const data = editing
        ? await updateProvider(editing.id, {
            label: label.trim() || meta.name,
            model: model.trim(),
            effort,
            ...(meta.needsBaseUrl ? { baseUrl: b } : {}),
            ...(trimmedKey ? { apiKey: trimmedKey } : {}),
            enabled,
            ...(makeDefault ? { makeDefault: true } : {}),
          })
        : await createProvider({ kind, label: label.trim() || undefined, model: model.trim(), effort, baseUrl: b, apiKey: trimmedKey, enabled, makeDefault });
      setApiKey("");
      onSaved(data);
      onOpenChange(false);
    } catch (err) {
      const { title } = describeError(err);
      setError(err instanceof AppError && err.message !== title ? `${title}: ${err.message}` : title);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={editing ? `Edit ${editing.label}` : "Add AI provider"}
      description={editing ? "Leave the key empty to keep the saved one." : "Your key is sent to Chrono's server over HTTPS, never to the provider from your device."}
      full
      footer={
        <Row>
          <Btn label="Test" icon={PlugZap} variant="secondary" loading={test.status === "running"} disabled={saving} onPress={() => void runTest()} style={{ flex: 1 }} testID="button-test-connection" />
          <Btn label={editing ? "Save" : "Add provider"} loading={saving} onPress={() => void save()} style={{ flex: 1 }} testID="button-save-provider" />
        </Row>
      }
    >
      {!editing ? (
        <View style={{ gap: 6 }}>
          <T variant="small" weight="medium" color="foreground">Provider</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
            {PROVIDER_KINDS.map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => pickKind(k)}
                  testID={`radio-kind-${k}`}
                  style={{ paddingHorizontal: 12, height: 40, borderRadius: RADIUS.md, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? a("primary", 0.1) : c.background, justifyContent: "center" }}
                >
                  <T variant="small" weight="medium" style={{ color: on ? c.primary : c.foreground }}>{PROVIDERS[k].name}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {meta.needsBaseUrl ? (
        <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} placeholder="https://api.example.com/v1" keyboardType="url" mono hint="Any server implementing OpenAI's /chat/completions. Must be public https — private and local addresses are blocked." testID="input-base-url" />
      ) : null}

      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T variant="small" weight="medium" color="foreground">
            API key{editing ? <T variant="tiny"> · saved {editing.keyHint}</T> : null}
          </T>
          {meta.keyUrl ? (
            <Row gap={4}>
              <T variant="small" color="primary" onPress={() => void WebBrowser.openBrowserAsync(meta.keyUrl!)}>Get a key</T>
              <ExternalLink size={12} color={c.primary} />
            </Row>
          ) : null}
        </Row>
        <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md, backgroundColor: c.background, paddingLeft: 12 }}>
          <TextInput
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={editing ? "Keep the saved key" : meta.keyPlaceholder}
            placeholderTextColor={c.mutedForeground}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
            testID="input-api-key"
            style={{ flex: 1, height: 44, color: c.foreground, fontFamily: FONT.mono, fontSize: 14 }}
          />
          <IconBtn icon={showKey ? EyeOff : Eye} label={showKey ? "Hide key" : "Show key"} onPress={() => setShowKey((s) => !s)} size={40} color="mutedForeground" />
        </View>
        <T variant="tiny">{storageNote}</T>
        {!editing && !trimmedKey ? <T variant="tiny">Enter the API key to unlock model choices for this provider.</T> : null}
      </View>

      {modelChoicesReady ? (
        <View style={{ gap: 6 }} testID="model-choice">
          <Field label="Model" value={model} onChangeText={setModel} placeholder={meta.needsBaseUrl ? "e.g. llama-4-maverick" : meta.defaultModel} mono testID="input-model" />
          {models.length ? (
            <T variant="tiny">{models.length} models available for this API key. Choose the primary model below.</T>
          ) : !editing && trimmedKey ? (
            <T variant="tiny">Test the key to fetch the models available to it.</T>
          ) : null}
          {suggestions.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityLabel="Suggested models">
              {suggestions.slice(0, 24).map((m) => (
                <Chip key={m} label={m} active={model === m} onPress={() => setModel(m)} />
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <View testID="model-choice-locked" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, padding: 12 }}>
          <T variant="small">Add an API key first. Your available models will appear here.</T>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <T variant="small" weight="medium" color="foreground">Effort</T>
        <Segmented<ProviderEffort> value={effort} onChange={setEffort} options={(["low", "medium", "high"] as ProviderEffort[]).map((v) => ({ value: v, label: v[0]!.toUpperCase() + v.slice(1) }))} />
        <T variant="tiny">Chrono maps effort to the selected provider’s native reasoning control when supported.</T>
      </View>

      <Field label="Name (optional)" value={label} onChangeText={setLabel} maxLength={60} placeholder={meta.name} autoCapitalize="sentences" testID="input-label" />

      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.md }}>
        <Row style={{ justifyContent: "space-between", padding: 12 }}>
          <T variant="h3" style={{ fontSize: 14 }}>Enabled</T>
          <Switch value={enabled} onValueChange={setEnabled} label="Enabled" />
        </Row>
        {!editing?.isDefault ? (
          <Row style={{ justifyContent: "space-between", padding: 12, borderTopWidth: 1, borderTopColor: c.border }}>
            <T variant="h3" style={{ fontSize: 14 }}>Use as default</T>
            <Switch value={makeDefault && enabled} disabled={!enabled} onValueChange={setMakeDefault} label="Use as default" />
          </Row>
        ) : null}
      </View>

      <TestResult state={test} />
      {error ? <T variant="small" color="danger" accessibilityRole="alert" testID="text-form-error">{error}</T> : null}
    </Sheet>
  );
}
