import { Redirect, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FolderGit2, Home, Settings, Sparkles, WandSparkles, type LucideIcon } from "lucide-react-native";
import { useSession } from "@/stores/session";
import { haptic } from "@/ui/kit";
import { FONT, useTheme } from "@/ui/theme";

const TABS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: "home", label: "Home", icon: Home },
  { name: "projects", label: "Projects", icon: FolderGit2 },
  { name: "ai", label: "AI", icon: Sparkles },
  { name: "skills", label: "Skills", icon: WandSparkles },
  { name: "settings", label: "Settings", icon: Settings },
];

/** Signed-in app shell: thumb-reachable bottom tab bar (the website uses a sidebar here). */
export default function TabsLayout() {
  const { isAuthed, loading } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!loading && !isAuthed) return <Redirect href="/signin" />;
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
      tabBar={({ state, navigation }) => (
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.sidebar, paddingBottom: Math.max(insets.bottom, 6), paddingTop: 6 }}>
          {state.routes.map((route, i) => {
            const meta = TABS.find((t) => t.name === route.name);
            if (!meta) return null;
            const focused = state.index === i;
            const Icon = meta.icon;
            return (
              <Pressable
                key={route.key}
                testID={`tab-${meta.name}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={meta.label}
                onPress={() => {
                  haptic.tap();
                  const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !ev.defaultPrevented) navigation.navigate(route.name);
                }}
                style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
              >
                <View style={{ paddingHorizontal: 14, paddingVertical: 3, borderRadius: 999, backgroundColor: focused ? c.surface2 : "transparent" }}>
                  <Icon size={20} color={focused ? c.primary : c.mutedForeground} />
                </View>
                <Text style={{ fontSize: 11, fontFamily: focused ? FONT.semibold : FONT.medium, color: focused ? c.foreground : c.mutedForeground }}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}
