import { useSyncExternalStore } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { probeJobs } from "./probe";

/** Renders the agent's hidden preview probes (see probe.ts). Mounted once in the root layout. */
export function ProbeHost() {
  const jobs = useSyncExternalStore(probeJobs.subscribe, probeJobs.get, probeJobs.get);
  if (!jobs.length) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: 390, height: 800, left: -10000, top: 0, opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {jobs.map((j) => (
        <WebView
          key={j.id}
          source={{ html: j.html, baseUrl: "https://preview.chrono.invalid/" }}
          originWhitelist={["*"]}
          onMessage={(e) => j.onMessage(e.nativeEvent.data)}
          onShouldStartLoadWithRequest={(r) => r.url.startsWith("https://preview.chrono.invalid/") || r.url === "about:blank" || r.url.startsWith("data:")}
          javaScriptEnabled
          domStorageEnabled={false}
          incognito
          style={{ width: 390, height: 800 }}
        />
      ))}
    </View>
  );
}
