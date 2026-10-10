import { vi } from "vitest";
// AsyncStorage / expo modules aren't available under Node; storage stays in memory for tests.
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getAllKeys: async () => [], multiGet: async () => [], setItem: async () => {}, removeItem: async () => {} },
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "test", extra: {} } } }));
vi.mock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {}, AFTER_FIRST_UNLOCK: 0 }));
