import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, ExternalLink, GitBranch, History, KeyRound, LogOut, Moon, Sparkles, Sun } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { ActiveProviderLink } from "@/features/ai/active-provider";
import { BackendStatus } from "@/features/settings/backend-status";
import { useSkills } from "@/features/skills/use-skills";
import { APP_VERSION } from "@/lib/monitoring";
import { WEB_URL } from "@/lib/config";
import { useSession } from "@/stores/session";
import { Avatar, ConfirmSheet, Divider, Header, ListRow, Row, Screen, Section, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

/** Flat group: rows edge to edge with inset hairlines, no card chrome. */
function Group({ children }: { children: ReactNode[] }) {
  const items = children.filter(Boolean);
  return (
    <View style={{ marginHorizontal: -16 }}>
      {items.map((child, i) => (
        <View key={i}>
          {i ? <Divider style={{ marginLeft: 49 }} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

const chevron = (color: string) => <ChevronRight size={16} color={color} />;

export default function SettingsScreen() {
  const { theme, setTheme, c, a } = useTheme();
  const { session, signOut } = useSession();
  const skills = useSkills();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const skillsOn = skills.all.filter((s) => skills.enabled.includes(s.id)).length;
  const skillsLine = skills.status === "loading" && !skills.all.length ? "Loading…" : `${skillsOn} of ${skills.all.length} enabled · guidance applied to every chat`;
  return (
    <>
      <Header title="Settings" large menu />
      <Screen>
        {session.mode === "github" ? (
          <Row gap={14} style={{ paddingTop: 4 }} testID="settings-account">
            <Avatar uri={session.user.avatarUrl} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T style={{ fontSize: 17, lineHeight: 22, fontFamily: FONT.semibold }} numberOfLines={1}>{session.user.name ?? session.user.login}</T>
              <T variant="monoSmall" numberOfLines={1}>@{session.user.login}</T>
            </View>
          </Row>
        ) : null}

        <Section title="Appearance">
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", padding: 3, borderRadius: RADIUS.md, backgroundColor: a("foreground", 0.06) }}>
            {(["dark", "light"] as const).map((t) => {
              const on = theme === t;
              const Icon = t === "dark" ? Moon : Sun;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t === "dark" ? "Dark theme" : "Light theme"}
                  onPress={() => setTheme(t)}
                  testID={`radio-theme-${t}`}
                  style={{ flex: 1, minHeight: 44, borderRadius: RADIUS.sm, backgroundColor: on ? c.background : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Icon size={16} color={on ? c.foreground : c.mutedForeground} />
                  <T style={{ fontSize: 14, fontFamily: on ? FONT.semibold : FONT.medium, color: on ? c.foreground : c.mutedForeground }}>{t === "dark" ? "Dark" : "Light"}</T>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="AI">
          <Group>
            {[
              <ActiveProviderLink key="provider" />,
              <ListRow key="manage" icon={KeyRound} title="Manage providers" subtitle="Add your own key, pick models, set the default" onPress={() => router.push("/ai-providers")} right={chevron(c.mutedForeground)} testID="button-manage-providers" />,
              <ListRow key="skills" icon={Sparkles} title="Skills" subtitle={skillsLine} onPress={() => router.push("/skills")} right={chevron(c.mutedForeground)} testID="link-settings-skills" />,
              <ListRow key="history" icon={History} title="Task history" subtitle="Every agent task on this device" onPress={() => router.push("/history")} right={chevron(c.mutedForeground)} testID="link-settings-history" />,
            ]}
          </Group>
        </Section>

        <Section title="Integrations">
          <Group>
            {[
              <ListRow
                key="github"
                icon={GitBranch}
                title="GitHub"
                subtitle={session.mode === "github" ? `Connected as @${session.user.login} · repositories, branches, commits, pull requests` : "Not connected"}
                onPress={() => void WebBrowser.openBrowserAsync("https://github.com/settings/applications")}
                right={<ExternalLink size={15} color={c.mutedForeground} />}
                testID="row-integration-github"
              />,
            ]}
          </Group>
          <T variant="tiny" testID="text-integrations-note">
            Review or revoke Chrono's access on GitHub. Chrono doesn't connect to databases or hosting accounts; each project's Overview shows whether it needs a database and which variables it expects.
          </T>
        </Section>

        <Section title="Account">
          {session.mode === "github" ? (
            <View style={{ gap: 6 }}>
              {[
                ["Access", session.includePrivate ? "Public and private repositories" : "Public repositories only"],
                ["Scopes", session.scopes.join(", ") || "—"],
                ["Session ends", new Date(session.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })],
              ].map(([k, v]) => (
                <Row key={k} center={false} gap={12}>
                  <T variant="small" style={{ width: 104 }}>{k}</T>
                  <T variant="small" color="foreground" style={{ flex: 1, fontFamily: k === "Scopes" ? FONT.mono : FONT.regular }}>{v}</T>
                </Row>
              ))}
              <T variant="tiny" style={{ marginTop: 4 }}>Your GitHub token is sealed server-side; this device only keeps the encrypted session in its secure keychain. It's revoked on sign out.</T>
            </View>
          ) : (
            <T variant="small">Not signed in.</T>
          )}
          <Group>{[<ListRow key="out" icon={LogOut} title="Sign out" danger onPress={() => setConfirmOpen(true)} testID="button-signout" />]}</Group>
        </Section>

        <Section title="Backend">
          <BackendStatus />
        </Section>

        <Section title="About">
          <Group>{[<ListRow key="web" icon={ExternalLink} title="Open Chrono on the web" subtitle={WEB_URL.replace(/^https?:\/\//, "")} onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)} />]}</Group>
          <T variant="monoSmall" style={{ paddingTop: 4 }}>Chrono for iOS & Android · v{APP_VERSION}</T>
        </Section>
      </Screen>
      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Sign out?"
        description="You'll return to the start screen."
        confirmLabel="Sign out"
        danger
        onConfirm={() => {
          setConfirmOpen(false);
          void signOut().then(() => router.replace("/"));
        }}
      />
    </>
  );
}
