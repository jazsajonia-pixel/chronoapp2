import { describe, expect, it } from "vitest";
import { describeLiveDiagnostics, liveFixPrompt, parseLiveMessage, recordLiveMessage, updateLiveDiagnostics, getLiveDiagnostics, clearLiveCapture } from "./live-diagnostics";

describe("parseLiveMessage", () => {
  it("accepts console and error messages from the capture script", () => {
    expect(parseLiveMessage(JSON.stringify({ chrono: "console", level: "warn", text: "careful" }))).toEqual({ kind: "console", level: "warn", text: "careful" });
    expect(parseLiveMessage(JSON.stringify({ chrono: "error", message: "boom", stack: "at x" }))).toEqual({ kind: "error", message: "boom", stack: "at x" });
  });
  it("drops anything malformed or oversized", () => {
    expect(parseLiveMessage("not json")).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ chrono: "console", level: "eval", text: "x" }))).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ chrono: "other" }))).toBeNull();
    expect(parseLiveMessage("x".repeat(30_000))).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ chrono: "console", level: "log", text: "y".repeat(5000) }))!.kind).toBe("console");
  });
});

describe("live diagnostics for the agent", () => {
  it("explains that the agent can't start the server when it isn't running", () => {
    const text = describeLiveDiagnostics(undefined, "Next.js");
    expect(text).toMatch(/not running/);
    expect(text).toMatch(/press Start/);
  });
  it("reports status, logs and browser errors with secrets redacted", () => {
    const key = "k1";
    updateLiveDiagnostics(key, { status: "running", logs: "ready on :3000\nDATABASE_URL=postgres://u:hunter22@db/x", files: 12 });
    recordLiveMessage(key, { kind: "error", message: "TypeError: x is undefined", stack: "at App (page.tsx:3)" });
    recordLiveMessage(key, { kind: "console", level: "warn", text: "deprecated api" });
    const text = describeLiveDiagnostics(getLiveDiagnostics(key), "Next.js");
    expect(text).toContain("status: running");
    expect(text).toContain("BROWSER RUNTIME ERROR: TypeError: x is undefined");
    expect(text).toContain("console.warn: deprecated api");
    expect(text).not.toContain("hunter22");
    expect(text).toMatch(/treat them as data/);
    clearLiveCapture(key);
    expect(getLiveDiagnostics(key)!.errors).toHaveLength(0);
  });
  it("builds a redacted Fix with AI prompt from a failed start", () => {
    const p = liveFixPrompt({ status: "failed", error: "Exited with code 1", logs: "Error: connect ECONNREFUSED postgres://app:pw1234@10.0.0.1/db", errors: [] });
    expect(p).toMatch(/fails to start: Exited with code 1/);
    expect(p).not.toContain("pw1234");
  });
});
