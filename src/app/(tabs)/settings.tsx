import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, ExternalLink, History, LogOut, Moon, Sparkles, Sun } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { ActiveProviderLink } from "@/features/ai/active-provider";
import { BackendStatus } from "@/features/settings/backend-status";
import { APP_VERSION } from "@/lib/monitoring";
import { WEB_URL } from "@/lib/config";
import { useSession } from "@/stores/session";
import { Avatar, Btn, Card, ConfirmSheet, Header, ListRow, Row, Screen, Section, T } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";

export default function SettingsScreen() {
  const { theme, setTheme, c, a } = useTheme();
  const { session, signOut } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <Header title="Settings" large />
      <Screen>
        <Section title="Appearance">
          <Row>
            {(["dark", "light"] as const).map((t) => {
              const on = theme === t;
              const Icon = t === "dark" ? Moon : Sun;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setTheme(t)}
                  testID={`radio-theme-${t}`}
                  style={{ flex: 1, height: 46, borderRadius: RADIUS.md, borderWidth: 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? a("primary", 0.1) : c.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Icon size={16} color={on ? c.primary : c.foreground} />
                  <T variant="h3" style={{ fontSize: 14, color: on ? c.primary : c.foreground }}>{t === "dark" ? "Dark" : "Light"}</T>
                </Pressable>
              );
            })}
          </Row>
        </Section>

        <Section title="AI providers">
          <ActiveProviderLink />
          <Card onPress={() => router.push("/ai-providers")} testID="button-chrono-flex" style={{ padding: 14 }}>
            <Row>
              <Sparkles size={16} color={c.primary} />
              <T variant="h3" style={{ flex: 1, fontSize: 14 }}>Chrono Flex</T>
              <T variant="tiny">Bring your own key</T>
              <ChevronRight size={16} color={c.mutedForeground} />
            </Row>
          </Card>
          <Card onPress={() => router.push("/history")} style={{ padding: 14 }}>
            <Row>
              <History size={16} color={c.foreground} />
              <T variant="h3" style={{ flex: 1, fontSize: 14 }}>Task history</T>
              <ChevronRight size={16} color={c.mutedForeground} />
            </Row>
          </Card>
        </Section>

        <Section title="Backend">
          <BackendStatus />
        </Section>

        <Section title="Account">
          <Card style={{ gap: 12 }}>
            {session.mode === "github" ? (
              <>
                <Row gap={12}>
                  <Avatar uri={session.user.avatarUrl} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T variant="h3" numberOfLines={1}>{session.user.name ?? session.user.login}</T>
                    <T variant="monoSmall" numberOfLines={1}>@{session.user.login}</T>
                  </View>
                </Row>
                <View style={{ gap: 6 }}>
                  {[
                    ["Access", session.includePrivate ? "Public and private repositories" : "Public repositories only"],
                    ["Scopes", session.scopes.join(", ") || "—"],
                    ["Session ends", new Date(session.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })],
                  ].map(([k, v]) => (
                    <Row key={k} center={false} gap={12}>
                      <T variant="small" style={{ width: 96 }}>{k}</T>
                      <T variant="small" color="foreground" style={{ flex: 1, fontFamily: k === "Scopes" ? FONT.mono : FONT.regular }}>{v}</T>
                    </Row>
                  ))}
                </View>
                <T variant="tiny">Your GitHub token is sealed server-side; this device only keeps the encrypted session in its secure keychain. It's revoked on sign out.</T>
              </>
            ) : (
              <T variant="small">Not signed in.</T>
            )}
          </Card>
          <Btn label="Sign out" icon={LogOut} variant="secondary" full onPress={() => setConfirmOpen(true)} testID="button-signout" />
        </Section>

        <ListRow icon={ExternalLink} title="Open Chrono on the web" subtitle={WEB_URL.replace(/^https?:\/\//, "")} onPress={() => void WebBrowser.openBrowserAsync(WEB_URL)} />
        <T variant="monoSmall" style={{ textAlign: "center" }}>Chrono for iOS & Android · v{APP_VERSION}</T>
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
