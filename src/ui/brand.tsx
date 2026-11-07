import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { T } from "./kit";
import { useTheme } from "./theme";

/** Chrono mark — same artwork as the website's /chrono-mark.svg and /chrono-mark-dark.svg. */
const MARK = {
  light: { prism: ["#2866F2", "#258FEA", "#16B7B0"], top: ["#8FE7FF", 0.72], bottom: ["#087EAC", 0.78], cursor: ["#A8F1FF", "#48D9DC"], line: "#48D9DC", dot: "#B4F5FF" },
  dark: { prism: ["#71B9FF", "#49C8F4", "#39E1D1"], top: ["#E3FBFF", 0.76], bottom: ["#0A9EAA", 0.86], cursor: ["#F2FDFF", "#8AF5E8"], line: "#82F4E9", dot: "#F0FFFF" },
} as const;

export function LogoMark({ size = 32 }: { size?: number }) {
  const { dark } = useTheme();
  const m = dark ? MARK.dark : MARK.light;
  const id = dark ? "d" : "l";
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityLabel="Chrono">
      <Defs>
        <LinearGradient id={`chrono-prism-${id}`} x1="10" y1="8" x2="62" y2="64" gradientUnits="userSpaceOnUse">
          <Stop stopColor={m.prism[0]} />
          <Stop offset="0.52" stopColor={m.prism[1]} />
          <Stop offset="1" stopColor={m.prism[2]} />
        </LinearGradient>
        <LinearGradient id={`chrono-cursor-${id}`} x1="33" y1="29" x2="48" y2="43" gradientUnits="userSpaceOnUse">
          <Stop stopColor={m.cursor[0]} />
          <Stop offset="1" stopColor={m.cursor[1]} />
        </LinearGradient>
      </Defs>
      <Path d="M56 8H33L9 32V40L33 64H56V49H39L25 36L39 23H56V8Z" fill={`url(#chrono-prism-${id})`} />
      <Path d="M33 8H56L43 21H39L25 32L20 27Z" fill={m.top[0]} opacity={m.top[1]} />
      <Path d="M39 51H43L56 64H33L20 45L25 40Z" fill={m.bottom[0]} opacity={m.bottom[1]} />
      <Path d="M40 28L48 36L40 44L32 36Z" fill={`url(#chrono-cursor-${id})`} />
      <Path d="M44.5 36H60" fill="none" stroke={m.line} strokeWidth={3.2} strokeLinecap="round" />
      <Circle cx="60" cy="36" r="3.4" fill={m.dot} />
    </Svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <LogoMark size={size} />
      <T variant="h2" style={{ fontSize: size * 0.62, letterSpacing: -0.4 }}>Chrono</T>
    </View>
  );
}

export function GitHubIcon({ size = 16, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"
      />
    </Svg>
  );
}
