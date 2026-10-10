import { useState } from "react";
import { Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Lock } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { AppError } from "@/lib/errors";
import { Btn, ErrorState, IconBtn, Row, Switch, T } from "@/ui/kit";
import { GitHubIcon, LogoMark } from "@/ui/brand";
import { RADIUS, useTheme } from "@/ui/theme";

export default function SignIn() {
  const { isAuthed, loading, endedReason, signIn } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [includePrivate, setIncludePrivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!loading && isAuthed) return <Redirect href="/projects" />;
  const shownError = error ?? (endedReason ? new AppError(endedReason) : null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      await signIn(includePrivate);
      router.replace("/projects");
    } catch (e) {
      // Cancelling the system sheet isn't an error worth shouting about.
      if (!(e instanceof AppError && e.code === "OAUTH_DENIED" && e.message === "Sign-in was cancelled.")) setError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 16 }}>
      <Row style={{ height: 52 }}>
        <IconBtn icon={ChevronLeft} label="Back to home" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </Row>
      <View style={{ flex: 1, justifyContent: "center", paddingBottom: 64, width: "100%", maxWidth: 420, alignSelf: "center" }}>
        <LogoMark size={40} />
        <T variant="title" style={{ marginTop: 22, fontSize: 21 }}>Sign in to Chrono</T>
        <T variant="small" style={{ marginTop: 8, fontSize: 14 }}>Connect GitHub to open your repositories. We never ask for your GitHub password.</T>
        <View style={{ marginTop: 28, gap: 12 }}>
          <Pressable onPress={() => setIncludePrivate((v) => !v)} testID="checkbox-include-private" style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: RADIUS.lg, backgroundColor: c.surface, padding: 12 }}>
            <View style={{ flex: 1 }}>
              <T variant="h3" style={{ fontSize: 14 }}>Include private repositories</T>
              <T variant="tiny" style={{ marginTop: 2 }}>
                Requests GitHub's <T variant="monoSmall">repo</T> scope. Leave off to grant public repositories only (<T variant="monoSmall">public_repo</T>).
              </T>
            </View>
            <Switch value={includePrivate} onValueChange={setIncludePrivate} label="Include private repositories" />
          </Pressable>
          <Btn
            size="lg"
            full
            testID="button-github-signin"
            label={pending ? "Waiting for GitHub…" : "Continue with GitHub"}
            icon={() => <GitHubIcon size={17} color={c.primaryForeground} />}
            loading={pending}
            onPress={() => void start()}
          />
          {shownError ? <ErrorState error={shownError} /> : null}
        </View>
        <Row center={false} gap={8} style={{ marginTop: 28 }}>
          <Lock size={14} color={c.mutedForeground} style={{ marginTop: 2 }} />
          <T variant="tiny" style={{ flex: 1, lineHeight: 17 }}>
            Your GitHub token stays on the server, sealed inside an encrypted session that's kept in your device's secure keychain. It is never readable by the app, and it's revoked when you sign out.
          </T>
        </Row>
      </View>
    </View>
  );
}
