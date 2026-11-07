import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { classifyLiveFile, collectLiveFiles, LIVE_LIMITS, sanitizeLiveResponse, utf8Length } from "./live-files";

describe("classifyLiveFile", () => {
  it("never sends secrets or generated folders", () => {
    for (const p of [".env", ".env.local", "app/.env.production", "node_modules/x/index.js", "dist/a.js", ".git/config", "certs/server.pem", "id_rsa", ".npmrc", "a/.next/x.js"]) {
      expect(classifyLiveFile(p)).toBe("omit");
    }
  });
  it("routes binaries to the server-side asset copy and keeps source as text", () => {
    expect(classifyLiveFile("public/logo.PNG")).toBe("asset");
    expect(classifyLiveFile("fonts/a.woff2")).toBe("asset");
    expect(classifyLiveFile("src/main.tsx")).toBe("text");
    expect(classifyLiveFile("Dockerfile")).toBe("text");
    expect(classifyLiveFile(".env.example.md")).toBe("omit");
  });
});

describe("utf8Length", () => {
  it("matches TextEncoder", () => {
    for (const s of ["", "abc", "héllo", "日本語", "emoji 😀 ok", "\u{10FFFF}"]) expect(utf8Length(s)).toBe(new TextEncoder().encode(s).byteLength);
  });
});

describe("collectLiveFiles", () => {
  const read = (map: Record<string, string | Error>) => async (p: string) => {
    const v = map[p];
    if (v instanceof Error) throw v;
    if (v === undefined) throw new AppError("NOT_FOUND");
    return v;
  };

  it("keeps order, includes edits as given, and sorts out assets and skipped files", async () => {
    const out = await collectLiveFiles(["package.json", "src/a.ts", "img.png", "big.txt", "gone.ts", ".env"], read({ "package.json": "{}", "src/a.ts": "x", "big.txt": new AppError("FILE_TOO_LARGE") }));
    expect(out.files.map((f) => f.path)).toEqual(["package.json", "src/a.ts"]);
    expect(out.assets.sort()).toEqual(["big.txt", "img.png"]);
    expect(out.skipped).toEqual(["gone.ts"]);
    expect(out.bytes).toBe(3);
  });

  it("enforces the file-count and size limits with clear messages", async () => {
    const many = Array.from({ length: LIVE_LIMITS.maxFiles + 1 }, (_, i) => `f${i}.js`);
    await expect(collectLiveFiles(many, async () => "")).rejects.toThrow(/up to 350 text files/);
    await expect(collectLiveFiles(["a.js"], async () => "x".repeat(LIVE_LIMITS.maxFileBytes + 1))).rejects.toThrow(/a\.js is too large/);
    const four = ["a", "b", "c", "d"].map((n) => `${n}.js`);
    await expect(collectLiveFiles(four, async () => "x".repeat(490_000))).rejects.toThrow(/1\.8 MB/);
  });

  it("names the file on unexpected failures and refuses an empty upload", async () => {
    await expect(collectLiveFiles(["a.js"], read({ "a.js": new AppError("NETWORK_OFFLINE", "offline") }))).rejects.toThrow(/Couldn't load a\.js: offline/);
    await expect(collectLiveFiles(["a.js"], read({}))).rejects.toThrow(/1 skipped/);
    await expect(collectLiveFiles(["logo.png"], read({}))).rejects.toThrow(/no text files/);
  });
});

describe("sanitizeLiveResponse", () => {
  it("accepts the server contract and drops unsafe URLs", () => {
    expect(sanitizeLiveResponse({ status: "running", url: "https://sb-123.vercel.run", logs: "ok", files: 3 })).toEqual({ status: "running", url: "https://sb-123.vercel.run", logs: "ok", files: 3 });
    expect(sanitizeLiveResponse({ status: "running", url: "javascript:alert(1)" })).toEqual({ status: "running" });
    expect(sanitizeLiveResponse({ status: "weird" })).toBeNull();
    expect(sanitizeLiveResponse(null)).toBeNull();
  });
});
