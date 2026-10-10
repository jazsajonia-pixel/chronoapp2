import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useWorkspace } from "@/features/workspace/context";
import { FilesBrowser } from "./files-browser";
import { EditorScreen } from "./editor-screen";
import { SearchPanel } from "./search-panel";
import { FONT, useTheme } from "@/ui/theme";

type View_ = "tree" | "editor" | "search";

/**
 * Files tab: tree ↔ editor ↔ project search. Opens straight into the editor when tabs are open.
 * The editor stays mounted while you browse, so undo history and cursor survive.
 */
export function FilesTab({ onGit }: { onGit: () => void }) {
  const { c } = useTheme();
  const ws = useWorkspace();
  const [view, setView] = useState<View_>(() => (ws.data.active ? "editor" : "tree"));
  useEffect(() => {
    if (view === "editor" && !ws.data.active) setView("tree");
  }, [view, ws.data.active]);
  // Files opened from elsewhere (palette, Git, preview errors, agent) switch to the editor.
  const prevActive = useRef(ws.data.active);
  const prevJump = useRef(ws.jump);
  useEffect(() => {
    if ((ws.data.active && ws.data.active !== prevActive.current) || (ws.jump && ws.jump !== prevJump.current)) setView("editor");
    prevActive.current = ws.data.active;
    prevJump.current = ws.jump;
  }, [ws.data.active, ws.jump]);

  const open = (path: string, line?: number) => {
    ws.openFile(path, line);
    setView("editor");
  };
  const showEditor = view === "editor" && !!ws.data.active;
  return (
    <View style={{ flex: 1 }}>
      {ws.data.active ? (
        <View style={showEditor ? { flex: 1 } : { display: "none" }}>
          <EditorScreen visible={showEditor} onGit={onGit} onOpenSearch={() => setView("search")} />
        </View>
      ) : null}
      {view === "search" ? <SearchPanel onBack={() => setView("tree")} onOpen={open} /> : null}
      {view === "tree" || (view === "editor" && !ws.data.active) ? (
        <View style={{ flex: 1 }}>
          <FilesBrowser onOpen={(p) => open(p)} onSearch={() => setView("search")} />
          {ws.data.tabs.length ? (
            <Pressable onPress={() => setView("editor")} testID="button-back-editor" style={{ position: "absolute", right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: c.primary, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
              <Text style={{ color: c.primaryForeground, fontFamily: FONT.semibold, fontSize: 14 }}>
                {ws.data.tabs.length} open file{ws.data.tabs.length === 1 ? "" : "s"}
              </Text>
              <ChevronRight size={16} color={c.primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
