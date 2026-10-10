import { useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CornerDownLeft, FileCode2, FolderGit2, KeyRound, LogOut, MessageSquarePlus, Moon, Plus, Search, Sun, X, type LucideIcon } from "lucide-react-native";
import { MAIN_NAV, projectPath } from "@/lib/nav";
import { useSession } from "@/stores/session";
import { githubApi } from "@/features/github/api";
import { recentRepos } from "@/features/github/recent";
import type { RepoSummary } from "@/types/github";
import { closeCommandPalette, requestNewRepo, usePaletteState } from "./palette-store";
import { T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

/** Simple ranked match: prefix > word start > substring > in-order characters. 0 = no match. */
export function score(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t.startsWith(q)) return 4;
  if (t.includes(` ${q}`) || t.includes(`/${q}`)) return 3;
  if (t.includes(q)) return 2;
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

const GROUP_LIMIT: Record<string, number> = { Files: 8, Repositories: 6 };
let repoCache: Promise<RepoSummary[]> | null = null;

type Row_ = { kind: "header"; group: string } | { kind: "item"; item: Item };

/** Global search palette: pages, actions, repositories and (inside a workspace) files. */
export function CommandPalette() {
  const { c, a, theme, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const { open, files } = usePaletteState();
  const { session, isAuthed, signOut } = useSession();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<RepoSummary[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    if (isAuthed) {
      repoCache ??= githubApi
        .repos(1)
        .then((r) => r.repos)
        .catch(() => {
          repoCache = null;
          return [];
        });
      void repoCache.then(setRepos);
    }
  }, [open, isAuthed]);
  useEffect(() => {
    if (!isAuthed) closeCommandPalette();
  }, [isAuthed]);

  const workspace = /^\/project\/([^/]+)\/([^/?]+)/.exec(pathname);
  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href as never);
    const out: Item[] = [];
    out.push({
      id: "action-new-chat",
      group: "Actions",
      label: workspace ? "New AI chat in this project" : "New AI chat",
      icon: MessageSquarePlus,
      keywords: "ask agent assistant",
      run: workspace ? () => router.setParams({ tab: "ai" }) : go("/ai"),
    });
    out.push({
      id: "action-new-repo",
      group: "Actions",
      label: "Create new repository",
      icon: Plus,
      keywords: "github repo project add",
      run: () => {
        requestNewRepo();
        router.navigate("/projects");
      },
    });
    out.push({ id: "action-theme", group: "Actions", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", icon: theme === "dark" ? Sun : Moon, keywords: "theme appearance", run: toggle });
    for (const n of MAIN_NAV) out.push({ id: `page-${n.href}`, group: "Go to", label: n.label, hint: "Page", icon: n.icon, run: () => router.navigate(n.href as never) });
    out.push({ id: "page-ai-providers", group: "Go to", label: "AI providers", hint: "Settings", icon: KeyRound, keywords: "api key model", run: go("/ai-providers") });
    out.push({ id: "page-history", group: "Go to", label: "Task history", hint: "Page", icon: MAIN_NAV[2]!.icon, keywords: "tasks agent", run: go("/history") });
    const seen = new Set<string>();
    const repoItem = (owner: string, name: string, hint?: string): Item => ({ id: `repo-${owner}/${name}`, group: "Repositories", label: `${owner}/${name}`, hint, icon: FolderGit2, run: go(projectPath(owner, name)) });
    for (const r of recentRepos()) {
      seen.add(`${r.owner}/${r.name}`);
      out.push(repoItem(r.owner, r.name, "Recent"));
    }
    for (const r of repos) if (!seen.has(r.fullName)) out.push(repoItem(r.owner, r.name, r.private ? "Private" : undefined));
    if (files) for (const p of files.paths) out.push({ id: `file-${p}`, group: "Files", label: p, hint: files.label, icon: FileCode2, run: () => files.open(p) });
    if (session.mode === "github") out.push({ id: "action-signout", group: "Actions", label: "Sign out", icon: LogOut, run: () => void signOut().then(() => router.replace("/signin")) });
    return out;
  }, [workspace?.[1], workspace?.[2], theme, toggle, repos, files, session.mode, signOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<Row_[]>(() => {
    const q = query.trim();
    const scored = items.map((it) => ({ it, s: Math.max(score(it.label, q), it.keywords ? score(it.keywords, q) * 0.9 : 0) })).filter((x) => x.s > 0);
    const visible = q ? scored : scored.filter((x) => x.it.group !== "Files");
    if (q) visible.sort((x, y) => y.s - x.s);
    const perGroup = new Map<string, number>();
    const capped = visible.filter(({ it }) => {
      const n = (perGroup.get(it.group) ?? 0) + 1;
      perGroup.set(it.group, n);
      return n <= (GROUP_LIMIT[it.group] ?? 20);
    });
    const order = [...new Set(capped.map((x) => x.it.group))];
    return order.flatMap((g) => [{ kind: "header", group: g } as Row_, ...capped.filter((x) => x.it.group === g).map((x) => ({ kind: "item", item: x.it }) as Row_)]);
  }, [items, query]);
  const firstItem = rows.find((r): r is Extract<Row_, { kind: "item" }> => r.kind === "item")?.item;

  const run = (it: Item | undefined) => {
    if (!it) return;
    closeCommandPalette();
    // Let the modal close before navigating.
    setTimeout(it.run, Platform.OS === "ios" ? 250 : 0);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeCommandPalette} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable onPress={closeCommandPalette} accessibilityLabel="Close search" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <View testID="command-palette" accessibilityViewIsModal style={{ marginTop: insets.top + 12, marginHorizontal: 12, maxHeight: "80%", borderRadius: RADIUS.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, elevation: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 54, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Search size={18} color={c.mutedForeground} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => run(firstItem)}
              placeholder={files ? "Search files, repos, pages, actions…" : "Search repos, pages, actions…"}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              accessibilityLabel="Search commands"
              testID="input-command-palette"
              style={{ flex: 1, color: c.foreground, fontFamily: FONT.regular, fontSize: 16 }}
            />
            <Pressable onPress={closeCommandPalette} hitSlop={8} accessibilityLabel="Close">
              <X size={18} color={c.mutedForeground} />
            </Pressable>
          </View>
          {rows.length === 0 ? (
            <T variant="small" style={{ padding: 20, textAlign: "center" }}>No results for “{query}”.</T>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r) => (r.kind === "header" ? `h-${r.group}` : r.item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item: r }) => {
                if (r.kind === "header") return <T variant="label" style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>{r.group}</T>;
                const it = r.item;
                const first = it === firstItem && !!query;
                const Icon = it.icon;
                return (
                  <Pressable onPress={() => run(it)} testID={`palette-${it.id}`} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 16, backgroundColor: pressed || first ? a("primary", 0.1) : "transparent" })}>
                    <Icon size={17} color={first ? c.primary : c.mutedForeground} />
                    <Text numberOfLines={1} ellipsizeMode={it.group === "Files" ? "head" : "tail"} style={{ flex: 1, fontFamily: it.group === "Files" || it.group === "Repositories" ? FONT.mono : FONT.medium, fontSize: it.group === "Files" ? 13 : 15, color: c.foreground }}>
                      {it.label}
                    </Text>
                    {it.hint ? <T variant="tiny" numberOfLines={1} style={{ maxWidth: 110 }}>{it.hint}</T> : null}
                    {first ? <CornerDownLeft size={14} color={c.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
