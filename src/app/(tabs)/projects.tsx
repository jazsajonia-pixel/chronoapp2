import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Archive, ChevronRight, GitBranch, GitFork, Lock, Plus, Search } from "lucide-react-native";
import { NewRepoSheet } from "@/features/github/new-repo";
import { onNewRepoRequest, takeNewRepoRequest } from "@/features/command/palette-store";
import { rememberRepo } from "@/features/github/recent";
import { githubApi } from "@/features/github/api";
import { useSession } from "@/stores/session";
import { projectPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import type { RepoSummary } from "@/types/github";
import { Badge, Btn, Card, EmptyState, ErrorState, Header, IconBtn, Row, Skeleton, T } from "@/ui/kit";
import { GitHubIcon } from "@/ui/brand";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

function RepoRow({ repo }: { repo: RepoSummary }) {
  const { c } = useTheme();
  return (
    <Card onPress={() => router.push(projectPath(repo.owner, repo.name))} testID={`row-repo-${repo.owner}-${repo.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Row gap={8}>
          <T variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
            <T variant="body" color="mutedForeground">{repo.owner}/</T>
            {repo.name}
          </T>
          {repo.private ? <Badge label="private" icon={Lock} /> : <Badge label="public" />}
        </Row>
        {repo.description ? <T variant="small" numberOfLines={2}>{repo.description}</T> : null}
        <Row gap={10} style={{ flexWrap: "wrap" }}>
          <Row gap={4}>
            <GitBranch size={12} color={c.mutedForeground} />
            <T variant="monoSmall">{repo.defaultBranch}</T>
          </Row>
          {repo.language ? <T variant="tiny">{repo.language}</T> : null}
          {repo.pushedAt ? <T variant="tiny">Updated {timeAgo(new Date(repo.pushedAt))}</T> : null}
          {repo.fork ? (
            <Row gap={3}>
              <GitFork size={11} color={c.mutedForeground} />
              <T variant="tiny">fork</T>
            </Row>
          ) : null}
          {repo.archived ? (
            <Row gap={3}>
              <Archive size={11} color={c.mutedForeground} />
              <T variant="tiny">archived</T>
            </Row>
          ) : null}
          {!repo.permissions.push ? <T variant="tiny">read-only</T> : null}
        </Row>
      </View>
      <ChevronRight size={16} color={c.mutedForeground} />
    </Card>
  );
}

export default function ProjectsScreen() {
  const { session } = useSession();
  const { c } = useTheme();
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
    <View style={{ gap: 12, marginBottom: 12 }}>
      <View>
        <T variant="label" color="primary" style={{ fontSize: 10 }}>Your codebase</T>
        <T variant="small" style={{ marginTop: 4 }}>Open a repository and turn it into a focused Chrono workspace.</T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", height: 46, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 12, gap: 8 }}>
        <Search size={16} color={c.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search repositories"
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          testID="input-search-projects"
          style={{ flex: 1, color: c.foreground, fontFamily: FONT.regular, fontSize: 15 }}
        />
      </View>
      {status !== "loading" && repos.length ? (
        <T variant="tiny" testID="text-repo-count">
          {needle ? `${filtered.length} of ${repos.length} loaded` : `${repos.length}${hasNext ? "+" : ""} repositories`} · most recently pushed first
        </T>
      ) : null}
    </View>
  );

  const footer = (
    <View style={{ gap: 12, marginTop: 4 }}>
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
      <Header title="Projects" large right={gh ? <IconBtn icon={Plus} label="New repository" onPress={() => setCreating(true)} testID="button-new-repo" /> : null} />
      <FlatList
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={status === "loading" ? [] : filtered}
        keyExtractor={(r) => r.fullName}
        renderItem={({ item }) => <RepoRow repo={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={status === "refreshing"} onRefresh={() => load(1, true)} tintColor={c.mutedForeground} />}
        ListEmptyComponent={
          status === "loading" ? (
            <View style={{ gap: 8 }} accessibilityLabel="Loading repositories">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} style={{ gap: 8 }}>
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={12} width="80%" />
                  <Skeleton height={12} width="33%" />
                </Card>
              ))}
            </View>
          ) : status === "error" ? (
            <ErrorState error={error} onRetry={() => load(1)} />
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
