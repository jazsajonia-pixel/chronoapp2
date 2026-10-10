import { View } from "react-native";
import { CheckCircle2, CircleDashed } from "lucide-react-native";
import { useHealth } from "./use-health";
import { API_BASE } from "@/lib/config";
import { Divider, ErrorState, Row, Skeleton, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

/** Which server-side capabilities are configured (booleans only — values never leave the server). */
export function BackendStatus() {
  const health = useHealth();
  const { c } = useTheme();
  if (health.status === "loading") {
    return (
      <View style={{ gap: 8 }} accessibilityLabel="Checking backend">
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </View>
    );
  }
  if (health.status === "error") return <ErrorState error={health.error} onRetry={health.retry} />;
  const cap = health.data.capabilities;
  const rows: [string, boolean, string][] = [
    ["GitHub OAuth app", cap.githubOAuth, "GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET"],
    ["Session signing", cap.sessions, "SESSION_SECRET"],
    ["Database (Neon)", cap.database, "DATABASE_URL"],
    ["Key encryption", cap.encryption, "ENCRYPTION_KEY"],
  ];
  return (
    <View testID="list-backend-status" style={{ borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, backgroundColor: c.surface, overflow: "hidden" }}>
      {rows.map(([label, ok, vars], i) => (
        <View key={label}>
          {i ? <Divider /> : null}
          <Row gap={12} style={{ padding: 12 }}>
            {ok ? <CheckCircle2 size={18} color={c.success} /> : <CircleDashed size={18} color={c.mutedForeground} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="h3" style={{ fontSize: 14 }}>{label}</T>
              <T variant="monoSmall" numberOfLines={1}>{vars}</T>
            </View>
            <T variant="small" color={ok ? "success" : "mutedForeground"} weight="medium">{ok ? "Ready" : "Not set"}</T>
          </Row>
        </View>
      ))}
      <Divider />
      <T variant="monoSmall" numberOfLines={1} style={{ padding: 12 }}>{API_BASE}</T>
    </View>
  );
}
