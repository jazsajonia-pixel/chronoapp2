import { getRandomValues } from "expo-crypto";

// Web Crypto subset used by shared code (lib/skills newSkillId, nonces).
const g = globalThis as { crypto?: { getRandomValues?: typeof getRandomValues } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = getRandomValues;
