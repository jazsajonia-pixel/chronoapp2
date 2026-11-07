import { router } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { useTheme } from "@/ui/theme";
import { PROVIDERS } from "@/lib/ai-catalog";
import { useProviders } from "./use-providers";
import { ListRow } from "@/ui/kit";

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
  return <ListRow icon={Sparkles} title={line} subtitle={sub} onPress={() => router.push("/ai-providers")} right={<ChevronRight size={16} color={c.mutedForeground} />} testID="link-ai-providers" subtitleTestID="text-active-provider" />;
}
