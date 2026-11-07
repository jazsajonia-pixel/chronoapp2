/**
 * Best-effort removal of secrets from text that leaves the device or reaches an AI model
 * (server logs, browser console output, error messages). It's a safety net, not a guarantee:
 * the real protection is that Chrono never injects secrets into previews.
 */
const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  // user:password@ in any URL (database URLs, git remotes, proxies)
  [/\b([a-z][a-z0-9+.-]*:\/\/)([^\s:/@]+):([^\s@/]+)@/gi, (_m, scheme: string, user: string) => `${scheme}${user}:[redacted]@`],
  // Authorization headers
  [/\b(bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{12,}/gi, (_m, kind: string) => `${kind} [redacted]`],
  // JWTs
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]"],
  // Well-known token formats
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, "[redacted-github-token]"],
  [/\bsk-(?:ant-|proj-|live_|test_)?[A-Za-z0-9_-]{16,}/g, "[redacted-key]"],
  [/\b(?:rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, "[redacted-key]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted-aws-key]"],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, "[redacted-key]"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, "[redacted-slack-token]"],
  [/\bnpg_[A-Za-z0-9]{12,}/g, "[redacted-key]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted-private-key]"],
  // KEY=value / "secret": "value" style assignments
  [
    /\b([A-Za-z0-9_]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|database_url|connection[_-]?string)[A-Za-z0-9_]*)(["']?\s*[:=]\s*["']?)([^\s"',;]{4,})/gi,
    (_m, key: string, sep: string) => `${key}${sep}[redacted]`,
  ],
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const [re, rep] of RULES) out = out.replace(re, rep as never);
  return out;
}
