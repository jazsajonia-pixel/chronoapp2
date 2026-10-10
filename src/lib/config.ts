import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; webUrl?: string };

/** Chrono backend (same Vercel API + Neon database as the website). */
export const WEB_URL = (process.env.EXPO_PUBLIC_CHRONO_URL ?? extra.webUrl ?? "https://chrono-tau.vercel.app").replace(/\/$/, "");
export const API_BASE = (process.env.EXPO_PUBLIC_CHRONO_API ?? extra.apiUrl ?? `${WEB_URL}/api`).replace(/\/$/, "");
