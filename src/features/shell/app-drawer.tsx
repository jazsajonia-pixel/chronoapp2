import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FolderGit2, Home, MessagesSquare, MonitorSmartphone, Search, Settings, SquarePen, type LucideIcon } from "lucide-react-native";
import { recentAgentTasks, type RecentTask } from "@/features/agent/store";
import { recentRepos, type RecentRepo } from "@/features/github/recent";
import { openCommandPalette } from "@/features/command/palette-store";
import { chatPath, projectPath } from "@/lib/nav";
import { timeAgo } from "@/lib/utils";
import { useSession } from "@/stores/session";
import { LogoMark } from "@/ui/brand";
import { Avatar, T, haptic } from "@/ui/kit";
import { FONT, RADIUS, useTheme } from "@/ui/theme";
import { closeDrawer, goTopLevel, useDrawerOpen, type TopLevel } from "./drawer-store";

const NAV: { href: TopLevel | "/preview"; label: string; icon: LucideIcon }[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/ai", label: "Chats", icon: MessagesSquare },
  { href: "/preview", label: "Preview", icon: MonitorSmartphone },
];

function DrawerRow({ icon: Icon, label, sublabel, active, onPress, testID, mono }: { icon?: LucideIcon; label: string; sublabel?: string; active?: boolean; onPress: () => void; testID?: string; mono?: boolean }) {
  const { c, a } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      android_ripple={{ color: a("foreground", 0.08) }}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginHorizontal: 8,
        borderRadius: RADIUS.md,
        backgroundColor: active ? a("foreground", 0.07) : pressed ? a("foreground", 0.05) : "transparent",
      })}
    >
      {Icon ? <Icon size={19} color={active ? c.primary : c.mutedForeground} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontSize: 15, fontFamily: mono ? FONT.mono : active ? FONT.semibold : FONT.medium, letterSpacing: mono ? -0.2 : 0 }}>
          {label}
        </T>
        {sublabel ? <T variant="small" numberOfLines={1}>{sublabel}</T> : null}
      </View>
    </Pressable>
  );
}

function Group({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4, minHeight: 28 }}>
        <T variant="small" style={{ fontFamily: FONT.medium }}>{title}</T>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
            <T variant="small" style={{ color: c.primary, fontFamily: FONT.medium }}>{action.label}</T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * The signed-in navigation sidebar (Claude/ChatGPT-style): new chat, search, destinations,
 * recent chats and recent projects, with the account pinned at the bottom.
 * Opens from the menu button in every top bar; closes on scrim tap, swipe left or Back.
 */
export function AppDrawer() {
  const open = useDrawerOpen();
  const { isAuthed, session } = useSession();
  const pathname = usePathname();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(340, Math.round(screenW * 0.86));
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v)).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion.current ? 0 : open ? 240 : 190,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  // Re-read device-local history each time the drawer opens.
  const chats = useMemo<RecentTask[]>(() => (open ? recentAgentTasks(8) : []), [open]);
  const repos = useMemo<RecentRepo[]>(() => (open ? recentRepos() : []), [open]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Capture phase: rows and the ScrollView would otherwise keep the touch,
        // so a horizontal left swipe never reached the drawer.
        onMoveShouldSetPanResponderCapture: (_, g) => g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => progress.setValue(Math.max(0, Math.min(1, 1 + g.dx / width))),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -width / 3 || g.vx < -0.5) closeDrawer();
          else Animated.timing(progress, { toValue: 1, duration: 140, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.timing(progress, { toValue: 1, duration: 140, useNativeDriver: true }).start();
        },
      }),
    [progress, width],
  );

  if (!isAuthed || !mounted) return null;

  const go = (fn: () => void) => {
    closeDrawer();
    fn();
  };
  const latest = repos[0] ?? null;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const scrim = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const user = session.mode === "github" ? session.user : null;
  const inWorkspace = pathname.startsWith("/project/");

  return (
    // In-tree overlay rather than a Modal: an Android Modal is its own window and ignores the app's
    // status-bar style (white icons on the light drawer). Back + a11y isolation are handled here and in the root layout.
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", opacity: scrim }}>
          <Pressable style={{ flex: 1 }} onPress={closeDrawer} accessibilityRole="button" accessibilityLabel="Close menu" testID="drawer-scrim" />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          testID="app-drawer"
          accessibilityViewIsModal
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: width + insets.left,
            paddingLeft: insets.left,
            backgroundColor: c.sidebar,
            borderRightWidth: 1,
            borderRightColor: c.border,
            transform: [{ translateX }],
          }}
        >
          <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 }}>
            <LogoMark size={24} />
            <T style={{ fontSize: 18, fontFamily: FONT.semibold, letterSpacing: -0.3 }}>Chrono</T>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ marginTop: 6 }}>
              <DrawerRow
                icon={SquarePen}
                label="New chat"
                sublabel={latest ? `in ${latest.owner}/${latest.name}` : "Open a project to chat about its code"}
                testID="drawer-new-chat"
                onPress={() => go(() => (latest ? router.push(chatPath(latest.owner, latest.name, { branch: latest.branch, task: "new" })) : goTopLevel("/projects", pathname)))}
              />
              <DrawerRow icon={Search} label="Search" sublabel="Files, projects and commands" testID="drawer-search" onPress={() => go(openCommandPalette)} />
            </View>

            <View style={{ height: 1, backgroundColor: c.border, marginHorizontal: 20, marginVertical: 10 }} />

            {NAV.map((n) => (
              <DrawerRow
                key={n.href}
                icon={n.icon}
                label={n.label}
                active={pathname === n.href}
                testID={`drawer-nav-${n.href.slice(1)}`}
                onPress={() => go(() => (n.href === "/preview" ? (pathname === "/preview" ? undefined : router.push("/preview")) : goTopLevel(n.href as TopLevel, pathname)))}
              />
            ))}

            {chats.length ? (
              <Group title="Recent chats" action={{ label: "All", onPress: () => go(() => router.push("/history")) }}>
                {chats.map((r) => (
                  <DrawerRow
                    key={`${r.key}/${r.task.id}`}
                    label={r.task.title}
                    sublabel={`${r.repo} · ${timeAgo(new Date(r.task.updatedAt))}`}
                    testID={`drawer-chat-${r.task.id}`}
                    onPress={() => go(() => router.push(chatPath(r.owner, r.repo, { branch: r.branch, task: r.task.id })))}
                  />
                ))}
              </Group>
            ) : null}

            {repos.length ? (
              <Group title="Recent projects" action={{ label: "All", onPress: () => go(() => goTopLevel("/projects", pathname)) }}>
                {repos.map((r) => {
                  const href = projectPath(r.owner, r.name);
                  const active = inWorkspace && pathname === href.split("?")[0];
                  return (
                    <DrawerRow
                      key={`${r.owner}/${r.name}`}
                      icon={FolderGit2}
                      label={r.name}
                      sublabel={`${r.owner} · ${r.branch}`}
                      active={active}
                      testID={`drawer-project-${r.owner}-${r.name}`}
                      onPress={() => go(() => (active ? undefined : router.push(href)))}
                    />
                  );
                })}
              </Group>
            ) : null}
          </ScrollView>

          <Pressable
            testID="drawer-account"
            accessibilityRole="button"
            accessibilityLabel="Settings and account"
            onPress={() => go(() => goTopLevel("/settings", pathname))}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 60,
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 10) + 4,
              borderTopWidth: 1,
              borderTopColor: c.border,
              backgroundColor: pressed || pathname === "/settings" ? c.surface : "transparent",
            })}
          >
            <Avatar uri={user?.avatarUrl} size={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T numberOfLines={1} style={{ fontSize: 15, fontFamily: FONT.medium }}>{user?.name ?? user?.login ?? "Account"}</T>
              <T variant="small" numberOfLines={1}>Settings, skills and providers</T>
            </View>
            <Settings size={19} color={c.mutedForeground} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
