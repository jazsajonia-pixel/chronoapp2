import { useEffect, useState } from "react";
import * as Network from "expo-network";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    void Network.getNetworkStateAsync().then((s) => alive && setOnline(s.isInternetReachable !== false && s.isConnected !== false)).catch(() => {});
    const sub = Network.addNetworkStateListener((s) => setOnline(s.isInternetReachable !== false && s.isConnected !== false));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return online;
}
