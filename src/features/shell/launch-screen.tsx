import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { G, Path } from "react-native-svg";
import { MARK_CHEVRON, MARK_RING } from "@/ui/brand";
import { BRAND, FONT } from "@/ui/theme";

/**
 * Chrono's cold-start screen. It replaces the native splash on the first frame and stays only while
 * real startup work runs: secure-storage hydration, the session token read, fonts, and — when a
 * session was saved — the server session check. It exits as soon as that work is done; nothing
 * here adds a minimum display time.
 *
 * The native splash (app.json → expo-splash-screen, imageWidth MARK_SIZE) draws the same vector
 * mark at the same size in the window centre, so the hand-off doesn't move the logo.
 */
export const MARK_SIZE = 96;
const TRACK = "#1C222B";
const TEXT = "#ECEEF2";
const MUTED = "#98A1B0";
const STATUS_DELAY_MS = 1600;
const SLOW_DELAY_MS = 8000;
const EXIT_MS = 160;

function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => alive && setReduce(false));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReduce(value));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

export function LaunchScreen({ appReady, fontsReady, restoring, onDone }: { appReady: boolean; fontsReady: boolean; restoring: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [phase, setPhase] = useState<"quiet" | "status" | "slow">("quiet");
  const [dismissed, setDismissed] = useState(false);
  const [reveal] = useState(() => new Animated.Value(0));
  const [nudge] = useState(() => new Animated.Value(0));
  const [travel] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [statusOpacity] = useState(() => new Animated.Value(0));
  const trackWidth = Math.min(width - 96, 220);
  const segmentWidth = Math.round(trackWidth * 0.32);
  const working = !appReady || (restoring && !dismissed);

  // Entrance: the wordmark rises in under the mark (the mark itself is already where the native
  // splash drew it), then the chevron steps forward once — "the next command".
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      reveal.setValue(1);
      return;
    }
    const entrance = Animated.sequence([
      Animated.timing(reveal, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(nudge, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(nudge, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [nudge, reduceMotion, reveal]);

  // The rail moves only while startup work is actually running.
  useEffect(() => {
    if (reduceMotion !== false || !working) return;
    travel.setValue(0);
    const loop = Animated.loop(
      Animated.timing(travel, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, travel, working]);

  // Explain a slow session check, then offer a way past it (the app retries in the background).
  useEffect(() => {
    if (!appReady || !restoring) return;
    const status = setTimeout(() => setPhase("status"), STATUS_DELAY_MS);
    const slow = setTimeout(() => setPhase("slow"), SLOW_DELAY_MS);
    return () => {
      clearTimeout(status);
      clearTimeout(slow);
    };
  }, [appReady, restoring]);

  useEffect(() => {
    if (phase === "quiet") return;
    Animated.timing(statusOpacity, { toValue: 1, duration: reduceMotion ? 0 : 180, useNativeDriver: true }).start();
  }, [phase, reduceMotion, statusOpacity]);

  // Ready: get out of the way immediately (touches pass through during the short fade).
  useEffect(() => {
    if (working || reduceMotion === null) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    const exit = Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    exit.start(({ finished }) => finished && onDone());
    return () => exit.stop();
  }, [onDone, opacity, reduceMotion, working]);

  const translateX = travel.interpolate({ inputRange: [0, 1], outputRange: [-segmentWidth, trackWidth] });
  const chevronX = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, MARK_SIZE * 0.035] });
  const bottomOffset = Math.max(48, insets.bottom + 32);
  const label = restoring ? "Restoring your Chrono session" : "Starting Chrono";

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      pointerEvents={working ? "auto" : "none"}
      accessibilityViewIsModal
      testID="launch-screen"
    >
      <View style={styles.center}>
        <View style={{ width: MARK_SIZE, height: MARK_SIZE }} accessible accessibilityRole="image" accessibilityLabel="Chrono">
          <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
            <G transform="translate(3 0)" fill="none" stroke={BRAND.ember} strokeLinecap="round">
              <Path d={MARK_RING} strokeWidth={17} />
            </G>
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: chevronX }] }]}>
            <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 120 120">
              <G transform="translate(3 0)" fill="none" stroke={BRAND.ember} strokeLinecap="round" strokeLinejoin="round">
                <Path d={MARK_CHEVRON} strokeWidth={12.5} />
              </G>
            </Svg>
          </Animated.View>
          <Animated.Text
            importantForAccessibility="no"
            style={[
              styles.wordmark,
              { fontFamily: fontsReady ? FONT.semibold : undefined },
              { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
            ]}
          >
            chrono
          </Animated.Text>
        </View>
      </View>

      <View
        style={[styles.track, { width: trackWidth, bottom: bottomOffset }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: working }}
      >
        {reduceMotion === false ? (
          <Animated.View style={[styles.segment, { width: segmentWidth, transform: [{ translateX }] }]} />
        ) : reduceMotion ? (
          // Reduced motion: a still, centred segment instead of a moving one.
          <View style={[styles.segment, { width: segmentWidth, marginLeft: (trackWidth - segmentWidth) / 2 }]} />
        ) : null}
      </View>

      {restoring && phase !== "quiet" ? (
        <Animated.View style={[styles.status, { bottom: bottomOffset + 22, opacity: statusOpacity }]} pointerEvents={phase === "slow" ? "box-none" : "none"}>
          <Text style={styles.statusText} accessibilityLiveRegion="polite" testID="launch-status">
            {phase === "slow" ? "Still connecting to Chrono…" : "Restoring your session…"}
          </Text>
          {phase === "slow" ? (
            <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" style={styles.continueButton} testID="launch-continue">
              <Text style={styles.continueText}>Continue without waiting</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND.ink, zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: {
    position: "absolute",
    top: MARK_SIZE + 14,
    left: -MARK_SIZE,
    right: -MARK_SIZE,
    textAlign: "center",
    color: TEXT,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.9,
  },
  track: { position: "absolute", alignSelf: "center", height: 2, borderRadius: 1, overflow: "hidden", backgroundColor: TRACK },
  segment: { height: 2, borderRadius: 1, backgroundColor: BRAND.ember },
  status: { position: "absolute", left: 24, right: 24, alignItems: "center", gap: 12 },
  statusText: { color: MUTED, fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, textAlign: "center" },
  continueButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: "#2A313C" },
  continueText: { color: TEXT, fontFamily: FONT.medium, fontSize: 13 },
});
