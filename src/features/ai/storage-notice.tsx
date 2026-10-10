import { View } from "react-native";
import { Database, ShieldCheck, Timer } from "lucide-react-native";
import type { ProvidersResponse } from "@/types/ai";
import { Row, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

/** States plainly where keys live — required by the security model, not decoration. */
export function StorageNotice({ data }: { data: ProvidersResponse }) {
  const { c, a } = useTheme();
  const Icon = data.storage === "database" ? Database : data.storage === "session" ? Timer : ShieldCheck;
  const title = data.storage === "database" ? "Saved encrypted on the server" : data.storage === "session" ? "Kept for this session only" : "Key storage unavailable";
  const tone = data.storage === "unavailable" ? "warning" : "primary";
  return (
    <Row center={false} gap={12} testID="notice-storage" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a(tone, 0.3), backgroundColor: a(tone, 0.06), padding: 14 }}>
      <Icon size={18} color={c[tone]} />
      <View style={{ flex: 1, gap: 4 }}>
        <T variant="h3" style={{ fontSize: 14 }}>{title}</T>
        <T variant="small">{data.storageNote}</T>
        <T variant="tiny">Keys are never shown again after saving — only a masked hint. All provider calls run in server functions.</T>
      </View>
    </Row>
  );
}
