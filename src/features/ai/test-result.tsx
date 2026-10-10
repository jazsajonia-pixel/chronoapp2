import { View } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { AppError, describeError } from "@/lib/errors";
import type { TestProviderResponse } from "@/types/ai";
import { Row, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

export type TestState = { status: "idle" } | { status: "running" } | { status: "ok"; result: TestProviderResponse } | { status: "error"; error: unknown };

/** Inline connection-test outcome. Server messages are already redacted of key material. */
export function TestResult({ state }: { state: TestState }) {
  const { c, a } = useTheme();
  if (state.status === "idle" || state.status === "running") return null;
  if (state.status === "ok") {
    const r = state.result;
    return (
      <Row center={false} gap={10} testID="test-result-ok" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: a("success", 0.3), backgroundColor: a("success", 0.08), padding: 12 }}>
        <CheckCircle2 size={17} color={c.success} />
        <View style={{ flex: 1 }}>
          <T variant="h3" style={{ fontSize: 14 }}>Connected · {r.latencyMs} ms</T>
          <T variant="small">
            <T variant="monoSmall" color="foreground">{r.model}</T> responded.
            {r.modelListed === false ? " It isn't in this key's model list, but it answered (it may be an alias)." : ""}
            {r.models.length ? ` ${r.models.length} models available.` : ""}
          </T>
        </View>
      </Row>
    );
  }
  const { title, hint, code } = describeError(state.error);
  const detail = state.error instanceof AppError && state.error.message !== title ? state.error.message : null;
  return (
    <Row center={false} gap={10} testID="test-result-error" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: a("danger", 0.3), backgroundColor: a("danger", 0.06), padding: 12 }}>
      <XCircle size={17} color={c.danger} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="h3" style={{ fontSize: 14 }}>{title}</T>
        {detail ? <T variant="small" color="foreground">{detail}</T> : null}
        <T variant="small">{hint}</T>
        <T variant="monoSmall">{code}</T>
      </View>
    </Row>
  );
}
