import { View, ScrollView } from "react-native";
import { router, type ErrorBoundaryProps } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Home, RotateCw } from "lucide-react-native";
import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";
import { Btn, T } from "@/ui/kit";
import { FONT, useTheme } from "@/ui/theme";

/** Route-level error boundary (expo-router): reports, then offers a retry instead of a white screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError("boundary", error);
  }, [error]);
  const theme = useTheme();
  const bg = theme.c.background;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 }}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <AlertTriangle size={28} color={theme.c.danger} />
        <T variant="h2" style={{ textAlign: "center" }}>Something went wrong</T>
        <T variant="small" style={{ textAlign: "center" }}>{error.message.slice(0, 300)}</T>
        <Btn label="Try again" icon={RotateCw} onPress={retry} />
      </View>
    </ScrollView>
  );
}

/**
 * Per-screen boundary: a crash in one screen keeps the rest of the app usable. Each route exports
 * it as `ErrorBoundary`, so it resets when you leave the screen; "Go home" is the way out.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError("boundary", error);
  }, [error]);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ alignItems: "center", gap: 12 }} testID="screen-error">
        <AlertTriangle size={28} color={c.danger} />
        <T variant="h2" style={{ textAlign: "center" }}>This screen hit a problem</T>
        <T variant="small" style={{ textAlign: "center" }}>The rest of Chrono still works. Your edits are saved on this device.</T>
        {error.message ? (
          <T variant="tiny" style={{ textAlign: "center", fontFamily: FONT.mono }} numberOfLines={4}>{error.message.slice(0, 300)}</T>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
          <Btn label="Try again" icon={RotateCw} onPress={retry} testID="button-screen-retry" />
          <Btn label="Go home" icon={Home} variant="secondary" onPress={() => router.replace("/")} testID="button-screen-home" />
        </View>
      </View>
    </ScrollView>
  );
}
