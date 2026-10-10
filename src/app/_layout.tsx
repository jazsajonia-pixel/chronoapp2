import "@/polyfills";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import * as Network from "expo-network";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Per-weight imports keep unused font files out of the bundle.
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { hydrateStorage } from "@/lib/storage";
import { setOffline } from "@/lib/api";
import { installErrorReporting, setMonitoringRoute } from "@/lib/monitoring";
import { reloadSkillsCache } from "@/features/skills/use-skills";
import { SessionProvider } from "@/stores/session";
import { ThemeProvider, useTheme } from "@/ui/theme";
import { ToastHost } from "@/ui/kit";
import { ProbeHost } from "@/features/preview/probe-host";
import { CommandPalette } from "@/features/command/command-palette";
import { ErrorBoundary as AppErrorBoundary } from "@/components/error-boundary";

void SplashScreen.preventAutoHideAsync().catch(() => {});
installErrorReporting();

export { AppErrorBoundary as ErrorBoundary };

function Chrome() {
  const { c, dark } = useTheme();
  const pathname = usePathname();
  useEffect(() => setMonitoringRoute(pathname), [pathname]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.background).catch(() => {});
  }, [c.background]);
  useEffect(() => {
    const sub = Network.addNetworkStateListener((s) => setOffline(s.isInternetReachable === false || s.isConnected === false));
    return () => sub.remove();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: "slide_from_right" }}>
        <Stack.Screen name="index" options={{ animation: "fade" }} />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      </Stack>
      <ProbeHost />
      <CommandPalette />
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_400Regular, GeistMono_500Medium });
  useEffect(() => {
    void hydrateStorage()
      .catch(() => {})
      .finally(() => {
        reloadSkillsCache();
        setReady(true);
      });
  }, []);
  // A font failure falls back to system fonts rather than blocking the app.
  const fonts = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready && fonts) void SplashScreen.hideAsync().catch(() => {});
  }, [ready, fonts]);
  if (!ready || !fonts) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <Chrome />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
