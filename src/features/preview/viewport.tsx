import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Maximize2, Monitor, Smartphone } from "lucide-react-native";
import { RADIUS, useTheme } from "@/ui/theme";

/** Preview viewport presets, shared by the in-browser preview and the live server preview. */
export type Device = "fit" | "phone" | "desktop";

/** Desktop mode: lay the page out at 1280px and let the WebView scale it down to fit. */
export const DESKTOP_VIEWPORT = `(function(){try{var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';(document.head||document.documentElement).appendChild(m);}m.content='width=1280';}catch(e){}})();true;`;

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Viewport" style={{ flexDirection: "row", borderRadius: RADIUS.sm, backgroundColor: c.muted, padding: 2 }}>
      {([["fit", "Fit", Maximize2], ["phone", "Phone", Smartphone], ["desktop", "Desktop", Monitor]] as const).map(([d, label, Icon]) => {
        const on = device === d;
        return (
          <Pressable key={d} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => onChange(d)} testID={`device-${d}`} style={{ width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.background : "transparent" }}>
            <Icon size={14} color={on ? c.foreground : c.mutedForeground} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Phone mode: a 390-wide frame on a muted stage. Other modes render the view as is. */
export function DeviceFrame({ device, children }: { device: Device; children: ReactNode }) {
  const { c } = useTheme();
  if (device !== "phone") return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: c.muted }}>
      <View style={{ flex: 1, width: 390, maxWidth: "94%", borderRadius: 26, borderWidth: 4, borderColor: c.foreground, overflow: "hidden", backgroundColor: "#fff" }}>{children}</View>
    </View>
  );
}
