import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { AlertTriangle, FilePlus2, FolderOpen, Search, TextSearch, Trash2, X } from "lucide-react-native";
import { FileTree, Mark } from "./file-tree";
import { buildTree } from "@/lib/tree";
import { useWorkspace } from "@/features/workspace/context";
import { useFileMarks } from "@/features/workspace/use-marks";
import { ConfirmSheet, EmptyState, IconBtn, PromptSheet, Row, T, toast } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/** File tree + "Go to file" + New file. Shared by the Files screen and the editor's drawer. */
export function FilesBrowser({ onOpen, onSearch, autoFocus = false }: { onOpen: (path: string) => void; onSearch?: () => void; autoFocus?: boolean }) {
  const { c, a } = useTheme();
  const ws = useWorkspace();
  const marks = useFileMarks();
  const [filter, setFilter] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const tree = useMemo(() => buildTree(ws.paths.map((path) => ({ path }))), [ws.paths]);
  const needle = filter.trim().toLowerCase();
  const matches = needle ? ws.paths.filter((p) => p.toLowerCase().includes(needle)).slice(0, 200) : null;
  const folder = ws.data.active?.includes("/") ? `${ws.data.active.slice(0, ws.data.active.lastIndexOf("/"))}/` : "";

  return (
    <View style={{ flex: 1 }}>
      <Row gap={4} style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 40, borderRadius: RADIUS.md, backgroundColor: c.muted, paddingHorizontal: 10, gap: 8 }}>
          <Search size={15} color={c.mutedForeground} />
          <TextInput
            value={filter}
            onChangeText={setFilter}
            autoFocus={autoFocus}
            placeholder={`Go to file · ${ws.paths.length.toLocaleString()}`}
            placeholderTextColor={c.mutedForeground}
            accessibilityLabel="Filter files"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            testID="input-filter-files"
            style={{ flex: 1, color: c.foreground, fontFamily: FONT.regular, fontSize: 14, paddingVertical: 0 }}
          />
          {filter ? (
            <Pressable onPress={() => setFilter("")} hitSlop={8} accessibilityLabel="Clear filter">
              <X size={15} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        {onSearch ? <IconBtn icon={TextSearch} label="Search in files" onPress={onSearch} testID="button-search-files" /> : null}
        <IconBtn icon={FilePlus2} label="New file" onPress={() => setNewOpen(true)} testID="button-new-file" />
      </Row>
      {ws.source.truncated ? (
        <Row center={false} gap={8} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: a("warning", 0.08) }}>
          <AlertTriangle size={14} color={c.warning} style={{ marginTop: 2 }} />
          <T variant="tiny" color="warning" style={{ flex: 1 }}>Large repository: GitHub returned a partial file list. Use “Go to file” or open the folder you need.</T>
        </Row>
      ) : null}
      {ws.paths.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No files on this branch" />
      ) : matches ? (
        matches.length ? (
          <FlatList
            data={matches}
            keyExtractor={(p) => p}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 80 }}
            renderItem={({ item: p }) => {
              const slash = p.lastIndexOf("/");
              return (
                <Pressable onPress={() => onOpen(p)} onLongPress={() => setToDelete(p)} style={({ pressed }) => ({ minHeight: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 4, backgroundColor: pressed ? c.surface2 : "transparent" })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 13, color: c.foreground }}>{p.slice(slash + 1)}</Text>
                    {slash > 0 ? <Text numberOfLines={1} style={{ fontFamily: FONT.mono, fontSize: 11, color: c.mutedForeground }}>{p.slice(0, slash)}</Text> : null}
                  </View>
                  <Mark mark={marks.get(p)} />
                  <IconBtn icon={Trash2} label={`Delete ${p}`} size={36} onPress={() => setToDelete(p)} />
                </Pressable>
              );
            }}
          />
        ) : (
          <EmptyState title="No files match" />
        )
      ) : (
        <FileTree nodes={tree} onOpen={onOpen} onDelete={setToDelete} marks={marks} active={ws.data.active} />
      )}
      <PromptSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New file"
        label="Path — created in this workspace; sent to GitHub when you commit"
        initial={folder}
        placeholder="src/components/Button.tsx"
        confirmLabel="Create file"
        validate={(v) => (!v || v.endsWith("/") ? "Enter a file path." : null)}
        onSubmit={(value) => {
          try {
            const path = ws.create(value);
            setNewOpen(false);
            onOpen(path);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Couldn't create the file.", "danger");
          }
        }}
      />
      <ConfirmSheet
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.slice(toDelete.lastIndexOf("/") + 1) ?? ""}?`}
        description={`${toDelete ?? ""} is removed from this workspace. This stays local until you commit.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (toDelete) void ws.remove(toDelete);
          setToDelete(null);
        }}
      />
    </View>
  );
}
