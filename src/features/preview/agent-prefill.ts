import { safeStorage } from "@/lib/storage";
import { emit } from "@/lib/events";

/** Hand a prompt to the AI tab (read once by the agent composer). The user still reviews and sends it. */
export function prefillAgent(storageKey: string, text: string, mode: "ask" | "agent") {
  safeStorage.set(`agent-prefill:${storageKey}`, JSON.stringify({ text, mode }), "session");
  emit("agent-prefill", { storageKey });
}
