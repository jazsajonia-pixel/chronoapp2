import { View, ScrollView } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { AlertTriangle, RotateCw } from "lucide-react-native";
import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";
import { Btn, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

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
