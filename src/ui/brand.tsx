import { Image, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { T } from "./kit";

/** Chrono's refined gradient C-arrow mark, exported from the canonical SVG. */
export function LogoMark({ size = 32 }: { size?: number; tone?: "dark" | "light" }) {
  return (
    <Image
      source={require("../../assets/brand/chrono-symbol.png")}
      style={{ width: size, height: size * (180 / 240) }}
      resizeMode="contain"
      accessibilityLabel="Chrono"
    />
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
