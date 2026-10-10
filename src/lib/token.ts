import * as SecureStore from "expo-secure-store";

/**
 * The sealed Chrono session (AES-GCM, opaque to the app) — the native equivalent of the website's
 * HTTP-only cookie. Stored in the iOS Keychain / Android Keystore, held in memory while running.
 */
const KEY = "chrono.session.v1";
let token: string | null = null;

export async function loadSessionToken(): Promise<string | null> {
  try {
    token = await SecureStore.getItemAsync(KEY);
  } catch {
    token = null;
  }
  return token;
}

export function getSessionToken(): string | null {
  return token;
}

export async function setSessionToken(value: string | null): Promise<void> {
  token = value;
  try {
    if (value) await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* memory-only for this run */
  }
}
