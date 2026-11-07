import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Archive, GitBranch, GitFork, Lock, Plus, Search } from "lucide-react-native";
import { NewRepoSheet } from "@/features/github/new-repo";
import { onNewRepoRequest, takeNewRepoRequest } from "@/features/command/palette-store";
import { rememberRepo } from "@/features/github/recent";
import { githubApi } from "@/features/github/api";
import { useSession } from "@/stores/session";
import { projectPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import type { RepoSummary } from "@/types/github";
import { Btn, Divider, EmptyState, ErrorState, Header, IconBtn, Row, Skeleton, T } from "@/ui/kit";
import { GitHubIcon } from "@/ui/brand";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

function RepoRow({ repo }: { repo: RepoSummary }) {
  const { c, a } = useTheme();
  const meta = [repo.language, repo.pushedAt ? `Updated ${timeAgo(new Date(repo.pushedAt))}` : null, repo.fork ? "fork" : null, repo.archived ? "archived" : null, !repo.permissions.push ? "read-only" : null].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={() => router.push(projectPath(repo.owner, repo.name))}
      testID={`row-repo-${repo.owner}-${repo.name}`}
      accessibilityRole="button"
      accessibilityLabel={`${repo.owner}/${repo.name}${repo.private ? ", private" : ""}`}
      android_ripple={{ color: a("foreground", 0.08) }}
      style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 16, minHeight: 64, gap: 3, backgroundColor: pressed ? a("foreground", 0.05) : "transparent" })}
    >
      <Row gap={6}>
        <T numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, fontFamily: FONT.semibold }}>{repo.name}</T>
        {repo.private ? <Lock size={13} color={c.mutedForeground} accessibilityLabel="Private" /> : null}
        {repo.fork ? <GitFork size={13} color={c.mutedForeground} accessibilityLabel="Fork" /> : null}
        {repo.archived ? <Archive size={13} color={c.mutedForeground} accessibilityLabel="Archived" /> : null}
      </Row>
      {repo.description ? <T variant="small" numberOfLines={2}>{repo.description}</T> : null}
      <Row gap={6} style={{ flexWrap: "wrap" }}>
        <T variant="monoSmall" style={{ fontSize: 12 }}>{repo.owner}</T>
        <GitBranch size={11} color={c.mutedForeground} />
        <T variant="monoSmall" style={{ fontSize: 12 }}>{repo.defaultBranch}</T>
        {meta ? <T variant="tiny">· {meta}</T> : null}
      </Row>
    </Pressable>
  );
}

export default function ProjectsScreen() {
  const { session } = useSession();
  const { c, a } = useTheme();
  const insets = useSafeAreaInsets();
  const gh = session.mode === "github" ? session : null;
  const [creating, setCreating] = useState(() => takeNewRepoRequest());
  useEffect(() => onNewRepoRequest(() => takeNewRepoRequest() && setCreating(true)), []);

  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<RepoSummary[][]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<"loading" | "idle" | "more" | "error" | "refreshing">("loading");
  const [error, setError] = useState<unknown>(null);

  const load = useCallback((page: number, refreshing = false) => {
    setStatus(refreshing ? "refreshing" : page === 1 ? "loading" : "more");
    setError(null);
    githubApi.repos(page).then(
      (res) => {
        setPages((p) => (page === 1 ? [res.repos] : [...p, res.repos]));
        setHasNext(res.hasNext);
        setStatus("idle");
      },
      (err: unknown) => {
        setError(err);
        setStatus("error");
      },
    );
  }, []);
  useEffect(() => load(1), [load]);

  const repos = useMemo(() => pages.flat(), [pages]);
  const needle = query.trim().toLowerCase();
  const filtered = needle ? repos.filter((r) => r.fullName.toLowerCase().includes(needle) || r.description?.toLowerCase().includes(needle)) : repos;
  const includePrivate = !!gh?.includePrivate;

  const header = (
    <View style={{ gap: 10, marginBottom: 8, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: RADIUS.lg, backgroundColor: a("foreground", 0.06), paddingHorizontal: 14, gap: 10 }}>
        <Search size={16} color={c.mutedForeground} />
        <TextInput disableFullscreenUI
          value={query}
          onChangeText={setQuery}
          placeholder="Search repositories"
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          testID="input-search-projects"
          style={{ flex: 1, color: c.foreground, fontFamily: FONT.regular, fontSize: 16, paddingVertical: 10 }}
        />
      </View>
      {status !== "loading" && repos.length ? (
        <T variant="tiny" testID="text-repo-count" style={{ paddingHorizontal: 2 }}>
          {needle ? `${filtered.length} of ${repos.length} loaded` : `${repos.length}${hasNext ? "+" : ""} repositories`} · most recently pushed first
        </T>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: 12, marginTop: 12, paddingHorizontal: 16 }}>
      {status === "error" && repos.length ? <ErrorState error={error} onRetry={() => load(pages.length + 1)} /> : null}
      {hasNext && status !== "error" ? <Btn label={status === "more" ? "Loading…" : "Load more"} variant="secondary" full disabled={status === "more"} onPress={() => load(pages.length + 1)} testID="button-load-more" /> : null}
      {!includePrivate && !repos.some((r) => r.private) && status !== "loading" ? (
        <T variant="tiny" style={{ textAlign: "center", paddingHorizontal: 12 }}>
          Private repositories are hidden because you signed in with public access only. Sign out and sign in again with “Include private repositories” to see them.
        </T>
      ) : null}
    </View>
  );

  return (
    <>
      <Header title="Projects" large menu right={gh ? <IconBtn icon={Plus} label="New repository" size={48} onPress={() => setCreating(true)} testID="button-new-repo" /> : null} />
      <FlatList
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 + insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}
        data={status === "loading" ? [] : filtered}
        keyExtractor={(r) => r.fullName}
        renderItem={({ item }) => <RepoRow repo={item} />}
        ItemSeparatorComponent={() => <Divider style={{ marginLeft: 16 }} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={status === "refreshing"} onRefresh={() => load(1, true)} tintColor={c.mutedForeground} />}
        ListEmptyComponent={
          status === "loading" ? (
            <View style={{ gap: 22, padding: 16 }} accessibilityLabel="Loading repositories">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ gap: 8 }}>
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={12} width="80%" />
                  <Skeleton height={12} width="33%" />
                </View>
              ))}
            </View>
          ) : status === "error" ? (
            <View style={{ padding: 16 }}><ErrorState error={error} onRetry={() => load(1)} /></View>
          ) : repos.length === 0 ? (
            <EmptyState icon={() => <GitHubIcon size={20} color={c.mutedForeground} />} title="No repositories yet">
              Create one with “New repository” to get started.
            </EmptyState>
          ) : (
            <EmptyState icon={Search} title="No matches">
              {hasNext ? "Only loaded repositories are searched — load more to search further." : "Try a different search."}
            </EmptyState>
          )
        }
      />
      {gh ? (
        <NewRepoSheet
          open={creating}
          onOpenChange={setCreating}
          owner={gh.user.login}
          canCreatePrivate={gh.includePrivate}
          onCreated={(repo) => {
            rememberRepo(repo.owner, repo.name, repo.defaultBranch);
            router.push(projectPath(repo.owner, repo.name, "overview"));
          }}
        />
      ) : null}
    </>
  );
}
