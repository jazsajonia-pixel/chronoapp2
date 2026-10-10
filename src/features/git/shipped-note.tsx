import { Linking, View } from "react-native";
import { GitCommitHorizontal, GitPullRequest } from "lucide-react-native";
import type { ShippedInfo } from "@/features/agent/task";
import { Row, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

/** Compact commit/PR line for an AI task whose changes were committed. */
export function ShippedNote({ info, compact = false }: { info: ShippedInfo; compact?: boolean }) {
  const { c, a } = useTheme();
  const short = info.sha.slice(0, 7);
  if (compact) {
    return (
      <T variant="monoSmall" color="primary" testID="text-task-shipped" numberOfLines={1}>
        {info.pr ? `PR #${info.pr.number}` : `Committed ${short}`}
      </T>
    );
  }
  return (
    <View testID="task-shipped" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: a("primary", 0.3), backgroundColor: a("primary", 0.06), padding: 12, gap: 4 }}>
      <Row gap={6}>
        <GitCommitHorizontal size={15} color={c.primary} />
        <T variant="h3" style={{ fontSize: 13 }}>Committed and pushed</T>
      </Row>
      <T variant="monoSmall">
        {short} on {info.branch}
      </T>
      {info.url || info.pr ? (
        <Row gap={14} style={{ marginTop: 4 }}>
          {info.url ? (
            <T variant="small" color="primary" weight="semibold" onPress={() => void Linking.openURL(info.url!)}>
              View commit
            </T>
          ) : null}
          {info.pr ? (
            <Row gap={4}>
              <GitPullRequest size={13} color={c.primary} />
              <T variant="small" color="primary" weight="semibold" onPress={() => void Linking.openURL(info.pr!.url)}>
                PR #{info.pr.number}
              </T>
            </Row>
          ) : null}
        </Row>
      ) : null}
    </View>
  );
}
