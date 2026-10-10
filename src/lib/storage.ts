import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Synchronous storage facade over AsyncStorage (same API as the website's `safeStorage`).
 * Everything under the `mdai:` prefix is loaded into memory once at startup (`hydrateStorage`),
 * reads are synchronous, writes go to memory immediately and are persisted in the background.
 * "session" values live in memory only (like the browser's sessionStorage: one app run).
 * Never store secrets here — the session token lives in the OS keychain (expo-secure-store).
 */
type Area = "local" | "session";

const PREFIX = "mdai:";
const local = new Map<string, string>();
const session = new Map<string, string>();
let hydrated = false;
const listeners = new Set<(key: string) => void>();

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [k, v] of pairs) if (v !== null) local.set(k.slice(PREFIX.length), v);
  } catch {
    /* start empty */
  }
  hydrated = true;
}

function persist(key: string, value: string | null) {
  const k = PREFIX + key;
  (value === null ? AsyncStorage.removeItem(k) : AsyncStorage.setItem(k, value)).catch(() => {});
}

function emit(key: string) {
  for (const l of listeners) l(key);
}

/** Total bytes kept locally (rough quota guard, mirrors browser storage limits). */
const QUOTA = 40 * 1024 * 1024;
function usage(): number {
  let n = 0;
  for (const [k, v] of local) n += k.length + v.length;
  return n * 2;
}

export const safeStorage = {
  get(key: string, kind: Area = "local"): string | null {
    return (kind === "local" ? local : session).get(key) ?? null;
  },
  set(key: string, value: string, kind: Area = "local"): void {
    if (kind === "session") {
      session.set(key, value);
      return;
    }
    local.set(key, value);
    persist(key, value);
    emit(key);
  },
  /** Like set(), but reports whether the value was persisted (false when over the local quota). */
  trySet(key: string, value: string, kind: Area = "local"): boolean {
    if (kind === "session") {
      session.set(key, value);
      return true;
    }
    const prev = local.get(key);
    local.set(key, value);
    if (usage() > QUOTA) {
      if (prev === undefined) local.delete(key);
      else local.set(key, prev);
      return false;
    }
    persist(key, value);
    emit(key);
    return true;
  },
  remove(key: string, kind: Area = "local"): void {
    if (kind === "session") {
      session.delete(key);
      return;
    }
    local.delete(key);
    persist(key, null);
    emit(key);
  },
  /** All keys in the local area (without the prefix). */
  keys(): string[] {
    return [...local.keys()];
  },
  subscribe(fn: (key: string) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
