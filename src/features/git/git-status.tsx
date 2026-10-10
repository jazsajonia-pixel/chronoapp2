import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { CheckCircle2, ExternalLink, GitCommitHorizontal, GitPullRequest, X } from "lucide-react-native";
import { useAsync } from "@/hooks/use-async";
import { AppError, describeError } from "@/lib/errors";
import { githubApi } from "@/features/github/api";
import type { GitTarget } from "./ship-panel";
import { prBody } from "./ship-panel";
import { clearLastShip, loadLastShip, saveLastShip, type ShipRecord } from "./ship-store";
import { Btn, IconBtn, Row, Skeleton, T } from "@/ui/kit";
import { RADIUS, useTheme } from "@/ui/theme";

const short = (sha: string) => sha.slice(0, 7);
function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Result of the last commit — shown after the branch switch so the user sees what happened. */
function ShipResult({ rec, target, onClose }: { rec: ShipRecord; target: GitTarget; onClose: () => void }) {
  const { c, a } = useTheme();
  const [pr, setPr] = useState(rec.pr);
  const [prError, setPrError] = useState(rec.prError);
  const [busy, setBusy] = useState(false);
  const subject = rec.message.split("\n")[0];
  async function retryPr() {
    setBusy(true);
    try {
      const r = await githubApi.createPull(rec.owner, rec.repo, { head: rec.branch, base: rec.from === rec.branch ? target.defaultBranch : rec.from, title: subject ?? rec.branch, body: prBody(rec.message) });
      const next = { number: r.pull.number, url: r.pull.url, existing: r.existing };
      setPr(next);
      setPrError(null);
      saveLastShip({ ...rec, pr: next, prError: null });
    } catch (e) {
      setPrError(e instanceof AppError ? e.message || describeError(e).title : "Couldn't open the pull request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View accessibilityRole="summary" testID="ship-result" style={{ borderRadius: RADIUS.lg, borderWidth: 1, borderColor: a("success", 0.35), backgroundColor: a("success", 0.07), padding: 14, gap: 10 }}>
      <Row center={false} gap={10}>
        <CheckCircle2 size={18} color={c.success} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="h3" style={{ fontSize: 14 }}>{`Pushed to ${rec.branch}`}</T>
          <T variant="small">
            <T variant="monoSmall" color="foreground">{short(rec.sha)}</T> · {subject} · {rec.files} file{rec.files === 1 ? "" : "s"}
          </T>
          {rec.created ? <T variant="tiny">New branch from {rec.from}. You're now working on it; {rec.from} is unchanged.</T> : null}
        </View>
        <IconBtn icon={X} label="Dismiss" size={32} onPress={onClose} />
      </Row>
      {rec.url || pr ? (
        <Row style={{ flexWrap: "wrap" }}>
          {rec.url ? <Btn label="View commit" icon={GitCommitHorizontal} variant="secondary" size="sm" onPress={() => void Linking.openURL(rec.url!)} testID="link-commit" /> : null}
          {pr ? <Btn label={`${pr.existing ? "Updated" : "Opened"} PR #${pr.number}`} icon={GitPullRequest} size="sm" onPress={() => void Linking.openURL(pr.url)} testID="link-pull-request" /> : null}
        </Row>
      ) : null}
      {prError ? (
        <View accessibilityRole="alert" style={{ gap: 8 }}>
          <T variant="small" color="warning">The commit is pushed, but the pull request wasn't opened: {prError}</T>
          <Btn label="Try again" icon={GitPullRequest} variant="secondary" size="sm" loading={busy} onPress={() => void retryPr()} testID="button-retry-pr" />
        </View>
      ) : null}
    </View>
  );
}

/** Branch status: last commit result, open PR for this branch, recent commits. */
export function GitStatus({ target, version, compact = false }: { target: GitTarget; version: number; compact?: boolean }) {
  const { c } = useTheme();
  const { owner, repo, branch, defaultBranch } = target;
  const [rec, setRec] = useState(() => {
    const r = loadLastShip(owner, repo);
    return r && (r.branch === branch || r.from === branch) ? r : null;
  });
  const commits = useAsync(() => githubApi.commits(owner, repo, branch), [owner, repo, branch, version]);
  const pulls = useAsync(() => (branch === defaultBranch ? Promise.resolve({ pulls: [] }) : githubApi.pulls(owner, repo, branch)), [owner, repo, branch, defaultBranch, version]);
  const [prBusy, setPrBusy] = useState(false);
  const [prErr, setPrErr] = useState<string | null>(null);
  async function openPr() {
    setPrBusy(true);
    setPrErr(null);
    try {
      const last = commits.status === "success" ? commits.data.commits[0]?.message : undefined;
      await githubApi.createPull(owner, repo, { head: branch, base: defaultBranch, title: last ?? branch, body: "Opened from Chrono. Review the diff before merging." });
      pulls.retry();
    } catch (e) {
      setPrErr(e instanceof AppError ? e.message || describeError(e).title : "Couldn't open the pull request.");
    } finally {
      setPrBusy(false);
    }
  }
  const openPull = pulls.status === "success" ? pulls.data.pulls[0] : undefined;
  return (
    <View style={{ gap: 12 }}>
      {rec && !compact ? (
        <ShipResult
          rec={rec}
          target={target}
          onClose={() => {
            clearLastShip(owner, repo);
            setRec(null);
          }}
        />
      ) : null}
      {branch !== defaultBranch ? (
        <View testID="pr-status" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 }}>
          {pulls.status === "loading" ? (
            <Skeleton height={18} />
          ) : openPull ? (
            <Pressable onPress={() => void Linking.openURL(openPull.url)}>
              <Row gap={8}>
                <GitPullRequest size={15} color={c.success} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T variant="small" color="foreground" numberOfLines={1} weight="medium">
                    PR #{openPull.number} · {openPull.title}
                  </T>
                  <T variant="tiny">
                    {openPull.draft ? "draft" : "open"} → {openPull.base}
                  </T>
                </View>
                <ExternalLink size={13} color={c.mutedForeground} />
              </Row>
            </Pressable>
          ) : (
            <Row gap={8}>
              <GitPullRequest size={15} color={c.mutedForeground} />
              <T variant="small" style={{ flex: 1 }}>No open pull request from {branch}.</T>
              {target.canPush ? <Btn label="Open PR" variant="secondary" size="sm" loading={prBusy} onPress={() => void openPr()} testID="button-open-pr" /> : null}
            </Row>
          )}
          {prErr ? <T variant="small" color="danger" accessibilityRole="alert">{prErr}</T> : null}
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <T variant="label">
          Recent commits on <T variant="monoSmall" color="foreground">{branch}</T>
        </T>
        {commits.status === "loading" ? (
          <View style={{ gap: 6 }}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </View>
        ) : commits.status === "error" ? (
          <T variant="small">
            Couldn't load commits ({describeError(commits.error).title.toLowerCase()}).{" "}
            <T variant="small" color="primary" onPress={commits.retry}>Retry</T>
          </T>
        ) : (
          <View testID="list-commits" style={{ borderRadius: RADIUS.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
            {commits.data.commits.slice(0, compact ? 3 : undefined).map((cm, i) => (
              <Pressable key={cm.sha} onPress={() => void Linking.openURL(cm.url)} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, backgroundColor: pressed ? c.surface2 : "transparent" })}>
                <Row gap={8}>
                  <T variant="monoSmall" color="primary">{short(cm.sha)}</T>
                  <T variant="small" color="foreground" numberOfLines={1} style={{ flex: 1 }}>{cm.message}</T>
                </Row>
                <T variant="tiny" style={{ marginTop: 2 }}>
                  {cm.author} · {ago(cm.date)}
                </T>
              </Pressable>
            ))}
            {commits.data.commits.length === 0 ? <T variant="small" style={{ padding: 12 }}>No commits yet.</T> : null}
          </View>
        )}
      </View>
    </View>
  );
}
