import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LogoMark } from "@/ui/brand";
import { FONT } from "@/ui/theme";

/** Shown only while a saved session is confirmed; the mark remains centred over the native splash. */

/** Same values as app.json → expo-splash-screen (backgroundColor, imageWidth) and scripts/make-icons.py. */
export const SPLASH_BACKGROUND = "#0A0F1A";
const SPLASH_IMAGE_WIDTH = 120;
const MARK_SCALE = 0.62;
const MARK_SIZE = Math.round(SPLASH_IMAGE_WIDTH * MARK_SCALE);
const MARK_HEIGHT = MARK_SIZE * (142 / 198);

const STATUS_DELAY_MS = 1200;
const SLOW_DELAY_MS = 8000;
const EXIT_MS = 220;
const TRACK_WIDTH = 176;
const SEGMENT_WIDTH = 54;

export function LaunchScreen({ restoring, onDone }: { restoring: boolean; onDone: () => void }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"quiet" | "status" | "slow">("quiet");
  const [dismissed, setDismissed] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [intro] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [statusOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => alive && setReduceMotion(false));
    return () => {
      alive = false;
    };
  }, []);

  // A quiet wordmark reveal and an indeterminate bar; neither implies measurable progress.
  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      intro.setValue(1);
      return;
    }
    const reveal = Animated.timing(intro, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true });
    reveal.start();
    return () => reveal.stop();
  }, [reduceMotion, intro]);
  useEffect(() => {
    if (reduceMotion !== false || !restoring) return;
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1250, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, restoring, progress]);

  // Status text only when the check is actually slow; "Continue" once it's slower than usual.
  useEffect(() => {
    const a = setTimeout(() => setPhase("status"), STATUS_DELAY_MS);
    const b = setTimeout(() => setPhase("slow"), SLOW_DELAY_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  useEffect(() => {
    if (phase === "quiet") return;
    Animated.timing(statusOpacity, { toValue: 1, duration: reduceMotion ? 0 : 200, useNativeDriver: true }).start();
  }, [phase, reduceMotion, statusOpacity]);

  // Leave when the session is settled (or the user chose not to wait).
  useEffect(() => {
    if (restoring && !dismissed) return;
    if (reduceMotion) {
      onDone();
      return;
    }
    const anim = Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
  }, [restoring, dismissed, reduceMotion, opacity, onDone]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-SEGMENT_WIDTH, TRACK_WIDTH] });
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      accessibilityViewIsModal
      testID="launch-screen"
    >
      <View style={styles.mark} accessible accessibilityRole="image" accessibilityLabel="Chrono">
        <LogoMark size={MARK_SIZE} />
      </View>
      <Animated.View style={[styles.brand, { opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
        <Image
          source={require("../../../assets/brand/chrono-wordmark.png")}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="Chrono. Code. Build. Innovate."
        />
      </Animated.View>
      <View style={styles.progressTrack} accessible accessibilityRole="progressbar" accessibilityLabel="Restoring your Chrono session">
        <Animated.View style={[styles.progressSegment, reduceMotion === false && { transform: [{ translateX }] }]} />
      </View>
      {/* Status and recovery stay separate from the branding and appear only when useful. */}
      <Animated.View style={[styles.status, { opacity: statusOpacity }]} pointerEvents={phase === "slow" ? "box-none" : "none"}>
        <Text style={styles.statusText} accessibilityLiveRegion="polite">
          {phase === "slow" ? "This is taking longer than usual. Chrono can't reach its server yet." : "Restoring your session…"}
        </Text>
        {phase === "slow" ? (
          <Pressable
            onPress={() => setDismissed(true)}
            accessibilityRole="button"
            accessibilityHint="Opens Chrono now; you'll be signed in as soon as the server answers."
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
            testID="button-launch-continue"
          >
            <Text style={styles.buttonText}>Continue without waiting</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BACKGROUND, alignItems: "center", justifyContent: "center", zIndex: 100, elevation: 100 },
  mark: { width: MARK_SIZE, height: MARK_HEIGHT },
  brand: { position: "absolute", top: "50%", marginTop: MARK_HEIGHT / 2 + 12, alignItems: "center" },
  wordmark: { width: 190, height: 62 },
  progressTrack: { position: "absolute", top: "50%", marginTop: MARK_HEIGHT / 2 + 92, width: TRACK_WIDTH, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "#1C2940" },
  progressSegment: { width: SEGMENT_WIDTH, height: 3, borderRadius: 2, backgroundColor: "#3B82F6" },
  status: { position: "absolute", top: "50%", marginTop: MARK_HEIGHT / 2 + 112, left: 32, right: 32, alignItems: "center", gap: 14 },
  statusText: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: "hsl(218, 11%, 64%)", textAlign: "center" },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: "hsl(218, 24%, 22%)", justifyContent: "center" },
  buttonText: { fontFamily: FONT.medium, fontSize: 14, color: "hsl(210, 20%, 95%)" },
});
