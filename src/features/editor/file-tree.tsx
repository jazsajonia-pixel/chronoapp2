import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { ChevronRight, FileCode2, FileText, Folder, FolderOpen, Trash2 } from "lucide-react-native";
import type { TreeNode } from "@/types/workspace";
import type { FileMark } from "./marks";
import { FONT, useTheme, type ColorName } from "@/ui/theme";

export type { FileMark };

const MARK_STYLE: Record<FileMark, { color: ColorName; label: string; letter: string }> = {
  added: { color: "diffAdd", label: "added", letter: "A" },
  modified: { color: "warning", label: "modified", letter: "M" },
  unsaved: { color: "primary", label: "unsaved", letter: "●" },
};

export function Mark({ mark }: { mark: FileMark | undefined }) {
  const { c } = useTheme();
  if (!mark) return null;
  const m = MARK_STYLE[mark];
  return (
    <Text accessibilityLabel={m.label} style={{ fontFamily: FONT.monoMedium, fontSize: 11, color: c[m.color], minWidth: 14, textAlign: "center" }}>
      {m.letter}
    </Text>
  );
}

function folderMarked(node: TreeNode, marks?: ReadonlyMap<string, FileMark>): boolean {
  if (!marks || marks.size === 0) return false;
  const prefix = `${node.path}/`;
  for (const k of marks.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

type Item = { node: TreeNode; depth: number };

const ROW_H = 44;

const Row = memo(function Row({ item, open, active, mark, dirty, onPress, onDelete }: { item: Item; open: boolean; active: boolean; mark?: FileMark; dirty: boolean; onPress: (n: TreeNode) => void; onDelete: (path: string) => void }) {
  const { c, a } = useTheme();
  const { node, depth } = item;
  const file = node.type === "file";
  const Icon = file ? (/\.(tsx?|jsx?|css|html|json)$/.test(node.name) ? FileCode2 : FileText) : open ? FolderOpen : Folder;
  return (
    <Pressable
      onPress={() => onPress(node)}
      onLongPress={file ? () => onDelete(node.path) : undefined}
      testID={file ? `file-${node.path}` : `folder-${node.path}`}
      accessibilityState={file ? { selected: active } : { expanded: open }}
      accessibilityHint={file ? "Long press to delete" : undefined}
      style={({ pressed }) => ({ height: ROW_H, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12 + depth * 16, paddingRight: 4, backgroundColor: active ? a("primary", 0.1) : pressed ? c.surface2 : "transparent" })}
    >
      {file ? <View style={{ width: 14 }} /> : <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><ChevronRight size={14} color={c.mutedForeground} /></View>}
      <Icon size={16} color={file ? (active ? c.primary : c.mutedForeground) : c.primary} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: file ? FONT.mono : FONT.medium, fontSize: file ? 13 : 14, color: active ? c.primary : c.foreground }}>{node.name}</Text>
      {file ? <Mark mark={mark} /> : dirty ? <View accessibilityLabel="contains changes" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.warning, marginRight: 8 }} /> : null}
      {file ? (
        <Pressable onPress={() => onDelete(node.path)} hitSlop={6} accessibilityLabel={`Delete ${node.name}`} testID={`button-delete-file-${node.path}`} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: 0.55 }}>
          <Trash2 size={14} color={c.mutedForeground} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

/** Virtualized file tree: folders expand in place; files open; long-press or trash to delete. */
export function FileTree({ nodes, onOpen, onDelete, marks, active, header }: { nodes: TreeNode[]; onOpen: (path: string) => void; onDelete: (path: string) => void; marks?: ReadonlyMap<string, FileMark>; active?: string | null; header?: React.ReactElement | null }) {
  // Top-level folders start expanded, like the website.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(nodes.filter((n) => n.type !== "file").map((n) => n.path)));
  const items = useMemo(() => {
    const out: Item[] = [];
    const walk = (list: TreeNode[], depth: number) => {
      for (const n of list) {
        out.push({ node: n, depth });
        if (n.type !== "file" && expanded.has(n.path) && n.children) walk(n.children, depth + 1);
      }
    };
    walk(nodes, 0);
    return out;
  }, [nodes, expanded]);
  const onPress = useCallback(
    (n: TreeNode) => {
      if (n.type === "file") return onOpen(n.path);
      setExpanded((s) => {
        const next = new Set(s);
        if (next.has(n.path)) next.delete(n.path);
        else next.add(n.path);
        return next;
      });
    },
    [onOpen],
  );
  return (
    <FlatList
      accessibilityLabel="Files"
      data={items}
      keyExtractor={(i) => i.node.path}
      ListHeaderComponent={header}
      getItemLayout={header ? undefined : (_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
      initialNumToRender={30}
      windowSize={11}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 80 }}
      renderItem={({ item }) => (
        <Row item={item} open={expanded.has(item.node.path)} active={active === item.node.path} mark={marks?.get(item.node.path)} dirty={item.node.type !== "file" && folderMarked(item.node, marks)} onPress={onPress} onDelete={onDelete} />
      )}
    />
  );
}
