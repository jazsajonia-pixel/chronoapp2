import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact";

describe("redactSecrets", () => {
  it("masks passwords in connection URLs but keeps the host for debugging", () => {
    const out = redactSecrets("connect ECONNREFUSED postgres://app:s3cr3tP4ss@db.example.com:5432/app");
    expect(out).toContain("postgres://app:[redacted]@db.example.com:5432/app");
    expect(out).not.toContain("s3cr3tP4ss");
  });
  it("masks env-style assignments", () => {
    expect(redactSecrets("DATABASE_URL=postgres://x STRIPE_SECRET_KEY=abcd1234efgh")).toBe("DATABASE_URL=[redacted] STRIPE_SECRET_KEY=[redacted]");
    expect(redactSecrets('{"apiKey": "abcdef123456"}')).toBe('{"apiKey": "[redacted]"}');
  });
  it("masks well-known tokens", () => {
    const s = "ghp_" + "a".repeat(36) + " sk-ant-" + "b".repeat(30) + " AKIA" + "C".repeat(16) + " Bearer " + "d".repeat(20);
    const out = redactSecrets(s);
    expect(out).not.toMatch(/a{36}|b{30}|C{16}|d{20}/);
  });
  it("masks JWTs and private keys", () => {
    expect(redactSecrets("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.abcdefghijk")).toBe("[redacted-jwt]");
    expect(redactSecrets("-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----")).toBe("[redacted-private-key]");
  });
  it("leaves ordinary log lines alone", () => {
    const line = "  VITE v5.4.12  ready in 812 ms\n  ➜  Local:   http://localhost:3000/\nTypeError: Cannot read properties of undefined (reading 'map')";
    expect(redactSecrets(line)).toBe(line);
  });
});
