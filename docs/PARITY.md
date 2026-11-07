# Web ↔ mobile parity (v1.1.0 audit, 2026-11-07)

Reference: website [`jazsajonia-pixel/chrono`](https://github.com/jazsajonia-pixel/chrono) at `6b750be` (main, production health reported this commit on 2026-11-07). Mobile: this repo, branch `feat/web-parity-1.1`.

## How this was audited

- Both repos were cloned and their shared modules compared file by file. The agent loop, runner, tool execution, proposals, git diff and commit message, history, Gemini model failover, AI catalog, workspace model and persistence, and GitHub API client are **byte-identical** to the website. The mobile port (2026-10-10) predates only the website changes of 2026-11-04 (PRs #13–#23).
- Production endpoints were called with `curl` (auth/session, health, preview-server).
- Status words: **Full** = implemented and covered by shared tests or checked against production; **Partial**; **Missing**; **Broken**; **Platform** = intentionally different on a phone; **N/A**.
- "Verified" below means typecheck + unit tests + Android bundle export, or an HTTP check against production. **Nothing in this release was tested on a physical device or emulator.** See `docs/TESTING.md`.

## Matrix

| Feature | Current Web | Current Mobile (before → after this release) | Gap | Priority | Implementation | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| A. GitHub sign-in (PKCE hand-off) | Full | **Broken → Full**: `/auth/session` started answering `{authenticated:false, canonicalOrigin}` on non-canonical hosts (web #20); the app deleted the fresh token, so every sign-in ended in "exchange failed" | Bearer clients hit the cookie-host check | P0 | `src/lib/session-check.ts`: retry once on the canonical origin (https, same parent domain); `api()` accepts a validated `baseUrl` | 7 unit tests; production: canonical host returns `{authenticated:false}` for an invalid bearer (i.e. evaluates bearer sessions) |
| A. Session restore / expiry / logout | Full | **Partial → Full**: network errors used to sign the user out | Token deleted on any failure | P0 | Token deleted only on a definitive signed-out / `SESSION_EXPIRED`; offline shows a retry banner (`restoreError`) | Unit tests; not device-tested |
| A. Secure storage | Cookie (httpOnly) | Platform: `expo-secure-store` (Keystore/Keychain) | — | — | unchanged | code review |
| B. Landing / home | Full (new copy #20/#21) | Partial → Full: old kicker labels, numbered features, fake window dots | Copy drift, decorative chrome | P2 | `src/app/index.tsx` uses the website's steps/features copy | typecheck |
| C. Repos, branches, new repo | Full | Full | — | — | unchanged (shared GitHub client) | shared tests |
| D. Workspace tabs (Overview, Files, AI, Preview, Git) | Full | Full; visited tabs stay mounted (same as web 6b750be) | — | — | unchanged | code review |
| E. Files (tree, search, new/rename/delete) | Full | Full | — | — | unchanged | shared tests |
| F. Editor (CodeMirror 6 in WebView) | Full | Full; drafts protected | — | — | unchanged | shared tests (model/persist) |
| G. AI agent (ask/agent, plans, diffs, approve per file) | Full | Full; proposals never write without approval | — | — | unchanged (shared runner/proposals); one hook dependency fix | shared tests |
| H. AI providers | Full ("AI providers") | Partial → Full: branded "Chrono Flex" | Wording | P3 | Renamed to "AI providers" / "Manage providers" | typecheck |
| I. Preview — on device | Full | Full | — | — | unchanged | shared tests |
| I. Preview — Live server (Vercel Sandbox) | Full (#14–#22, 6b750be) | **Missing → Full** | Server projects showed "can't be previewed" | P1 | `detect.ts` synced (`liveServer`); `live-files.ts` (same limits/omit rules); `use-live-server.ts` (same `/api/preview-server` contract, polling, stop on leave); `live-panel.tsx` (status, Start/Retry/Stop, reload, open in browser, logs, disclosure; WebView pinned to the sandbox origin) | 9 new unit tests; production endpoint returns 401 without a session; **not run end-to-end from a device** |
| J. Git (diff, commit, branch, PR, patch export) | Full | Full; nothing discarded silently | — | — | unchanged | shared tests |
| K. Skills | Full | Full | — | — | unchanged | shared tests |
| L. Settings (theme, providers, history, status, sign out) | Full | Full | wording only | P3 | see H | typecheck |
| Brand mark and icons | New prism mark (#13) | Partial → Full | Old ribbon mark | P3 | `src/ui/brand.tsx` light/dark variants; icon, adaptive fg/bg/monochrome, splash, favicon regenerated from the web SVG | Rendered and inspected |
| Canonical host redirect, update prompt | Full | N/A (native app has one API host and updates via APK) | — | — | — | — |
| Tooling | CI + lint | **Missing → Full**: no lint, no PR CI, Expo Doctor 1 failure | — | P1 | ESLint (`eslint-config-expo`), `ci.yml`, SDK 57 patch updates, typecheck + tests before the APK build | local: tsc ✓, eslint 0 errors, 66 tests ✓, expo-doctor 21/21, `expo export --platform android` ✓ |

## Recommended backend change (not made)

`netlify/functions/auth-session.ts` in the website could skip the `canonicalRedirectOrigin` check when the request carries a bearer session (`bearerSession(req)`), since bearer tokens aren't host-bound cookies. The app works without it; this would only save one round trip. Backward compatible; needs a test in the website repo.

## Follow-ups

1. Device pass on a ~4 GB Android phone using `docs/TESTING.md`.
2. React Compiler readiness: 31 lint warnings (`react-hooks/refs`, `set-state-in-effect`, `use-memo`) are kept as warnings rather than fixed in a mass rewrite. Clean them up file by file before enabling the compiler.
3. Release signing: the CI APK uses the Expo template's debug keystore. Use a real upload key (EAS credentials or a GitHub secret) before any store release.
