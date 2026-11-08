import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "@/ui/theme";

const BACKGROUND = "#080A10";
const TRACK = "#272A36";
const ACCENT = "#4D85FF";
const STATUS_DELAY_MS = 1600;
const SLOW_DELAY_MS = 8000;
const EXIT_MS = 180;

export function LaunchScreen({ appReady, fontsReady, restoring, onDone }: { appReady: boolean; fontsReady: boolean; restoring: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"quiet" | "status" | "slow">("quiet");
  const [dismissed, setDismissed] = useState(false);
  const [intro] = useState(() => new Animated.Value(0));
  const [travel] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [statusOpacity] = useState(() => new Animated.Value(0));
  const trackWidth = Math.min(width - 64, 326);
  const segmentWidth = Math.max(56, Math.round(trackWidth * 0.3));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduceMotion(value))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      intro.setValue(1);
      return;
    }
    const entrance = Animated.timing(intro, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [intro, reduceMotion]);

  useEffect(() => {
    if (reduceMotion !== false) return;
    const loop = Animated.loop(
      Animated.timing(travel, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, travel]);

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

  useEffect(() => {
    if (!appReady || (restoring && !dismissed) || reduceMotion === null) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    const exit = Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    exit.start(({ finished }) => finished && onDone());
    return () => exit.stop();
  }, [appReady, dismissed, onDone, opacity, reduceMotion, restoring]);

  const translateX = travel.interpolate({ inputRange: [0, 1], outputRange: [-segmentWidth, trackWidth] });
  const bottomOffset = Math.max(56, insets.bottom + 30);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity }]} accessibilityViewIsModal testID="launch-screen">
      <View style={styles.center}>
        <Animated.Text
          accessibilityRole="image"
          accessibilityLabel="Chrono"
          style={[
            styles.wordmark,
            { fontFamily: fontsReady ? FONT.semibold : undefined },
            {
              opacity: intro,
              transform: [
                { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
                { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
              ],
            },
          ]}
        >
          chrono
        </Animated.Text>
      </View>

      <View
        style={[styles.track, { width: trackWidth, bottom: bottomOffset }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={restoring ? "Restoring your Chrono session" : "Starting Chrono"}
      >
        <Animated.View
          style={[
            styles.segment,
            { width: segmentWidth },
            reduceMotion === false ? { transform: [{ translateX }] } : { width: 0 },
          ]}
        />
      </View>

      {restoring && phase !== "quiet" ? (
        <Animated.View style={[styles.status, { opacity: statusOpacity }]} pointerEvents={phase === "slow" ? "box-none" : "none"}>
          <Text style={styles.statusText} accessibilityLiveRegion="polite">
            {phase === "slow" ? "Still connecting to Chrono…" : "Restoring your session…"}
          </Text>
          {phase === "slow" ? (
            <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" style={styles.continueButton}>
              <Text style={styles.continueText}>Continue without waiting</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BACKGROUND, alignItems: "center", justifyContent: "center", zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: { color: "#F0F2F7", fontSize: 40, lineHeight: 48, letterSpacing: -1.25 },
  track: { position: "absolute", height: 4, borderRadius: 3, overflow: "hidden", backgroundColor: TRACK },
  segment: { height: 4, borderRadius: 3, backgroundColor: ACCENT },
  status: { position: "absolute", bottom: 78, left: 24, right: 24, alignItems: "center", gap: 12 },
  statusText: { color: "#9297A5", fontFamily: FONT.regular, fontSize: 13, lineHeight: 18, textAlign: "center" },
  continueButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: "#303544" },
  continueText: { color: "#E6E9F0", fontFamily: FONT.medium, fontSize: 13 },
});
