import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { MARK_COLORS, MarkHand, MarkRing } from "@/ui/brand";
import { FONT } from "@/ui/theme";

/**
 * Launch screen shown after the native splash while a saved session is being confirmed with the
 * Chrono API. It uses the native splash's background and mark at the same size and position, so the
 * hand-off can't be seen. A signed-out start never mounts it (see SessionProvider).
 *
 * Motion: the dial's hand sweeps while the app waits (a progress cue, not decoration). It starts
 * only after a short delay, so a fast restore shows a still mark and then fades into the app.
 * With Reduce Motion on, the hand stays still and the screen leaves without a fade.
 */

/** Same values as app.json → expo-splash-screen (backgroundColor, imageWidth) and scripts/make-icons.py. */
export const SPLASH_BACKGROUND = "#0A0F1A";
const SPLASH_IMAGE_WIDTH = 120;
const MARK_SCALE = 0.62;
const MARK_SIZE = Math.round(SPLASH_IMAGE_WIDTH * MARK_SCALE);

const SWEEP_DELAY_MS = 350;
const SWEEP_MS = 1400;
const STATUS_DELAY_MS = 1200;
const SLOW_DELAY_MS = 8000;
const EXIT_MS = 220;

export function LaunchScreen({ restoring, onDone }: { restoring: boolean; onDone: () => void }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"quiet" | "status" | "slow">("quiet");
  const [dismissed, setDismissed] = useState(false);
  const [turn] = useState(() => new Animated.Value(0));
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

  // Hand sweep: one eased revolution per loop, starting after a short pause.
  useEffect(() => {
    if (reduceMotion !== false) return;
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: SWEEP_MS, easing: Easing.bezier(0.45, 0, 0.25, 1), useNativeDriver: true }),
    );
    const t = setTimeout(() => loop.start(), SWEEP_DELAY_MS);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [reduceMotion, turn]);

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

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const colors = MARK_COLORS.dark;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      accessibilityViewIsModal
      testID="launch-screen"
    >
      <View style={styles.mark} accessible accessibilityRole="progressbar" accessibilityLabel="Chrono is starting">
        <MarkRing size={MARK_SIZE} color={colors.ring} />
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
          <MarkHand size={MARK_SIZE} color={colors.hand} />
        </Animated.View>
      </View>
      {/* Absolutely positioned under the mark so the mark never moves off the splash position. */}
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
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  status: { position: "absolute", top: "50%", marginTop: MARK_SIZE / 2 + 28, left: 32, right: 32, alignItems: "center", gap: 14 },
  statusText: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20, color: "hsl(218, 11%, 64%)", textAlign: "center" },
  button: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: "hsl(218, 24%, 22%)", justifyContent: "center" },
  buttonText: { fontFamily: FONT.medium, fontSize: 14, color: "hsl(210, 20%, 95%)" },
});
