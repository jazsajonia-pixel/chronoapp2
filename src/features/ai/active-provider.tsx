import { router } from "expo-router";
import { Sparkles, ChevronRight } from "lucide-react-native";
import { PROVIDERS } from "@/lib/ai-catalog";
import { useProviders } from "./use-providers";
import { Card, Row, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";
import { View } from "react-native";

/** One-line summary of the default provider, linking to AI provider settings. */
export function ActiveProviderLink() {
  const { state } = useProviders();
  const { c } = useTheme();
  let line: string;
  let sub: string;
  if (state.status === "loading") {
    line = "AI providers";
    sub = "Loading…";
  } else if (state.status === "error") {
    line = "AI providers";
    sub = "Couldn't load — tap to retry";
  } else {
    const d = state.data;
    const def = d.providers.find((p) => p.id === d.defaultId);
    const enabled = d.providers.filter((p) => p.enabled).length;
    line = def ? (def.label === PROVIDERS[def.kind].name ? def.label : `${def.label} · ${PROVIDERS[def.kind].name}`) : "No provider yet";
    sub = def ? `${def.model} · ${enabled} enabled` : "Add an OpenAI, Anthropic, Gemini, OpenRouter or compatible key";
  }
  return (
    <Card onPress={() => router.push("/ai-providers")} testID="link-ai-providers" style={{ padding: 14 }}>
      <Row gap={12}>
        <Sparkles size={18} color={c.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="h3" numberOfLines={1}>{line}</T>
          <T variant="small" numberOfLines={2} testID="text-active-provider">{sub}</T>
        </View>
        <ChevronRight size={16} color={c.mutedForeground} />
      </Row>
    </Card>
  );
}
