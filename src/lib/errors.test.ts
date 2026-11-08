import { describe, expect, it } from "vitest";
import { AppError, describeError } from "./errors";

describe("describeError", () => {
  it("uses the server's message for validation errors", () => {
    expect(describeError(new AppError("VALIDATION_FAILED", "Variable names use letters, digits and _.")).hint).toBe("Variable names use letters, digits and _.");
  });
  it("keeps the curated hint for other codes and unknown errors", () => {
    const d = describeError(new AppError("BACKEND_UNAVAILABLE", "fetch failed"));
    expect(d.title).toBe("Can't reach Chrono");
    expect(d.hint).not.toContain("fetch failed");
    expect(describeError(new Error("boom")).code).toBe("INTERNAL");
  });
  it("falls back to the hint when the message is just the title", () => {
    expect(describeError(new AppError("VALIDATION_FAILED")).hint).toBe("Check what you entered and try again.");
  });
});
