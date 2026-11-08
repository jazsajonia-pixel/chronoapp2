import { View } from "react-native";
import { CheckCircle2, Database, HardDrive, KeyRound } from "lucide-react-native";
import { Row, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";
import type { ProjectRequirements } from "./requirements";
import { useProjectRequirements } from "./use-requirements";

/**
 * What the project needs to run: database / hosted service / nothing. Read-only and derived from
 * the repository; Chrono never provisions anything from here. Variable names only, never values.
 */
export function RequirementsSection({ compact = false, value }: { compact?: boolean; value?: ProjectRequirements | null }) {
  const own = useProjectRequirements();
  const r = value === undefined ? own : value;
  const { c, a } = useTheme();

  if (!r) return compact ? null : <T variant="small">Checking the repository…</T>;
  const Icon = r.kind === "none" ? CheckCircle2 : r.kind === "local" ? HardDrive : r.kind === "service" ? KeyRound : Database;
  const tone = r.kind === "none" || r.kind === "local" ? c.success : c.warning;
  const vars = r.env.filter((e) => e.database || e.secret).slice(0, compact ? 4 : 10);

  return (
    <View testID="section-requirements" style={{ gap: 8 }}>
      <Row center={false} gap={8}>
        <Icon size={16} color={tone} style={{ marginTop: 1 }} />
        <T variant="small" color="foreground" weight="medium" style={{ flex: 1 }} testID="text-requirements-summary">{r.summary}</T>
      </Row>
      {r.kind !== "none" && (r.migrations.length > 0 || r.engines.length > 0) && !compact ? (
        <T variant="tiny">
          {[r.engines.join(" / "), r.tools.join(", "), r.migrations.length ? `${r.migrations.reduce((n, m) => n + m.count, 0)} migration file(s) in ${r.migrations[0]!.dir}` : ""].filter(Boolean).join(" · ")}
        </T>
      ) : null}
      {vars.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} testID="list-requirements-env">
          {vars.map((e) => (
            <View key={e.name} style={{ borderRadius: RADIUS.sm, backgroundColor: a("muted", 1), borderWidth: 1, borderColor: c.border, paddingHorizontal: 6, paddingVertical: 2 }}>
              <T variant="monoSmall" color="foreground">{e.name}</T>
            </View>
          ))}
        </View>
      ) : null}
      {r.kind === "database" || r.kind === "service" ? (
        <T variant="tiny" testID="text-requirements-preview-note">
          Live preview starts without environment variables, so {r.kind === "database" ? "database calls" : "calls to this service"} fail there. Pages that don’t touch it still load.
        </T>
      ) : null}
      {!compact && r.steps.length ? (
        <View style={{ gap: 4 }} testID="list-requirements-steps">
          {r.steps.map((s, i) => (
            <Row key={i} center={false} gap={6}>
              <T variant="tiny" style={{ width: 14 }}>{i + 1}.</T>
              <T variant="tiny" color="foreground" style={{ flex: 1 }}>{s}</T>
            </Row>
          ))}
        </View>
      ) : null}
    </View>
  );
}
