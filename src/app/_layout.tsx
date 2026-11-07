import "@/polyfills";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
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
import { loadSessionToken } from "@/lib/token";
import { setOffline } from "@/lib/api";
import { installErrorReporting, setMonitoringRoute } from "@/lib/monitoring";
import { reloadSkillsCache } from "@/features/skills/use-skills";
import { SessionProvider, useSession } from "@/stores/session";
import { ThemeProvider, useTheme } from "@/ui/theme";
import { ToastHost } from "@/ui/kit";
import { ProbeHost } from "@/features/preview/probe-host";
import { CommandPalette } from "@/features/command/command-palette";
import { AppDrawer } from "@/features/shell/app-drawer";
import { useDrawerOpen } from "@/features/shell/drawer-store";
import { ErrorBoundary as AppErrorBoundary } from "@/components/error-boundary";
import { LaunchScreen } from "@/features/shell/launch-screen";

void SplashScreen.preventAutoHideAsync().catch(() => {});
installErrorReporting();

export { AppErrorBoundary as ErrorBoundary };

function Chrome({
  launchVisible,
  onSessionRestoringChange,
}: {
  launchVisible: boolean;
  onSessionRestoringChange: (restoring: boolean) => void;
}) {
  const { c, dark } = useTheme();
  const pathname = usePathname();
  const drawerOpen = useDrawerOpen();
  const { loading: restoring } = useSession();
  useEffect(() => {
    const frame = requestAnimationFrame(() => onSessionRestoringChange(restoring));
    return () => cancelAnimationFrame(frame);
  }, [onSessionRestoringChange, restoring]);
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
      <ExpoStatusBar hidden={launchVisible} style={dark ? "light" : "dark"} />
      {/* While the drawer or launch screen is open, screen readers stay in the active layer. */}
      <View style={{ flex: 1 }} importantForAccessibility={drawerOpen || launchVisible ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={drawerOpen || launchVisible}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: "slide_from_right" }}>
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          <Stack.Screen name="(app)" options={{ animation: "fade" }} />
        </Stack>
      </View>
      <ProbeHost />
      <AppDrawer />
      <CommandPalette />
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_400Regular, GeistMono_500Medium });
  const [launchVisible, setLaunchVisible] = useState(true);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const hideLaunch = useCallback(() => setLaunchVisible(false), []);
  const reportSessionRestoring = useCallback((restoring: boolean) => setSessionRestoring(restoring), []);

  useEffect(() => {
    // Hydrate local app state while the animated launch overlay is already visible.
    void Promise.all([hydrateStorage().catch(() => {}), loadSessionToken().catch(() => null)])
      .finally(() => {
        reloadSkillsCache();
        setReady(true);
      });
  }, []);

  // A font failure falls back to system fonts rather than blocking the app.
  const fonts = fontsLoaded || !!fontError;
  const appReady = ready && fonts;
  useEffect(() => {
    // Reveal the React launch overlay on the first committed frame, not only after boot completes.
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: "#080A10" }}>
          {!appReady ? <ExpoStatusBar hidden style="light" /> : null}
          {appReady ? (
            <ThemeProvider>
              <SessionProvider>
                <Chrome launchVisible={launchVisible} onSessionRestoringChange={reportSessionRestoring} />
              </SessionProvider>
            </ThemeProvider>
          ) : null}
          {launchVisible ? (
            <LaunchScreen appReady={appReady} fontsReady={fonts} restoring={sessionRestoring} onDone={hideLaunch} />
          ) : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
