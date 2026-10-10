import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop, G } from "react-native-svg";
import { T } from "./kit";
import { useTheme } from "./theme";

/** Chrono mark — same artwork as the website's /chrono-mark.svg. */
export function LogoMark({ size = 32 }: { size?: number }) {
  const { dark } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" accessibilityLabel="Chrono">
      <Defs>
        <LinearGradient id="chrono-ribbon" x1="12" y1="10" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#39B9F2" />
          <Stop offset="0.58" stopColor="#26B9E8" />
          <Stop offset="1" stopColor="#16C9CE" />
        </LinearGradient>
      </Defs>
      <G transform="translate(4 0)">
        <Path d="M56 10H34C19.64 10 8 21.64 8 36s11.64 26 26 26h22V50H34c-7.73 0-14-6.27-14-14s6.27-14 14-14h22V10Z" fill="url(#chrono-ribbon)" />
        <Path d="M45 10H56V22H51L45 16Z" fill="#8AE6FF" />
        <Path d="M45 62H56V50H51L45 56Z" fill="#0A9EB2" />
        <Path d="M36 26A10 10 0 0 0 36 46" fill="none" stroke="#16C9CE" strokeWidth={3.2} strokeLinecap="round" />
        <Path d="M29 27H36V33H44V27H51V45H44V39H36V45H29Z" fill={dark ? "#E6F1FA" : "#0B1220"} />
        <Path d="M44 36H52.5" fill="none" stroke="#16C9CE" strokeWidth={3.2} strokeLinecap="round" />
        <Rect x="37.4" y="34.1" width="4.2" height="3.8" rx="0.7" fill="#54DED6" />
        <Rect x="52.5" y="33.1" width="6" height="5.8" rx="1.2" fill="#54DED6" />
      </G>
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
