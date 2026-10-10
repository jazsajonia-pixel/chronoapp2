import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Check, GitBranch, Lock, Search } from "lucide-react-native";
import type { BranchListResponse } from "@/types/github";
import type { AsyncState } from "@/hooks/use-async";
import { Badge, EmptyState, ErrorState, Row, Sheet, Skeleton, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

export function BranchPicker({ open, onOpenChange, branches, current, defaultBranch, onSelect, onRetry }: { open: boolean; onOpenChange: (open: boolean) => void; branches: AsyncState<BranchListResponse>; current: string; defaultBranch: string; onSelect: (branch: string) => void; onRetry: () => void }) {
  const { c, a } = useTheme();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    if (branches.status !== "success") return [];
    const all = [...branches.data.branches].sort((x, y) => (x.name === defaultBranch ? -1 : y.name === defaultBranch ? 1 : x.name.localeCompare(y.name)));
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((b) => b.name.toLowerCase().includes(needle)) : all;
  }, [branches, q, defaultBranch]);
  return (
    <Sheet open={open} onClose={() => onOpenChange(false)} title="Switch branch" description="Files reload from the selected branch.">
      <View style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.background, paddingHorizontal: 12, gap: 8 }}>
        <Search size={16} color={c.mutedForeground} />
        <TextInput value={q} onChangeText={setQ} placeholder="Find a branch" placeholderTextColor={c.mutedForeground} autoCapitalize="none" autoCorrect={false} testID="input-branch-search" style={{ flex: 1, color: c.foreground, fontFamily: FONT.mono, fontSize: 14 }} />
      </View>
      {branches.status === "loading" ? (
        <View style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={44} />)}
        </View>
      ) : branches.status === "error" ? (
        <ErrorState error={branches.error} onRetry={onRetry} />
      ) : list.length === 0 ? (
        <EmptyState title="No branches match" />
      ) : (
        <View testID="list-branches" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
          {list.map((b, i) => {
            const on = b.name === current;
            return (
              <Pressable
                key={b.name}
                onPress={() => onSelect(b.name)}
                testID={`branch-${b.name}`}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: on ? a("primary", 0.08) : pressed ? c.surface2 : "transparent" })}
              >
                <GitBranch size={15} color={on ? c.primary : c.mutedForeground} />
                <T variant="mono" numberOfLines={1} style={{ flex: 1, color: on ? c.primary : c.foreground }}>{b.name}</T>
                {b.name === defaultBranch ? <Badge label="default" /> : null}
                {b.protected ? <Lock size={13} color={c.mutedForeground} /> : null}
                {on ? <Check size={16} color={c.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {branches.status === "success" && branches.data.truncated ? <T variant="tiny">Showing the first {branches.data.branches.length} branches.</T> : null}
    </Sheet>
  );
}
