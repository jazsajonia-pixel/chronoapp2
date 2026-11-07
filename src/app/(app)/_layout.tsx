import { Redirect, Stack } from "expo-router";
import { useSession } from "@/stores/session";
import { useTheme } from "@/ui/theme";

/**
 * Signed-in app shell. There's no bottom tab bar: every top-level screen has a menu button
 * that opens the app drawer (features/shell/app-drawer.tsx), so screens get the full height.
 * Skills is a sub-page of Settings.
 */
export default function AppLayout() {
  const { isAuthed, loading } = useSession();
  const { c } = useTheme();
  if (!loading && !isAuthed) return <Redirect href="/signin" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: "fade_from_bottom", animationDuration: 200 }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="ai" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="skills" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
