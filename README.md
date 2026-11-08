# Chrono for iOS and Android

Chrono's native companion app brings the mobile-first GitHub coding workspace to iOS and Android. Built with Expo, React Native, and `expo-router`, it uses native screens rather than wrapping the web app.

The app connects to the shared Chrono API and Neon Postgres database, so accounts, AI provider settings, skills, and workspace data stay in sync with the web experience.

## Features (parity with the website)

| Area | What you get |
| --- | --- |
| Sign-in | GitHub OAuth in the system browser (PKCE), session stored in the iOS Keychain / Android Keystore |
| Home | Recent projects, quick actions, active AI provider, backend status |
| Projects | Your GitHub repositories with search, filters, pagination, and **New repository** |
| Workspace | Per-repo **Overview** dashboard (incl. **Runtime needs**: whether the project needs a database, which one, migrations and expected env var names), **Files**, **AI**, **Preview**, **Git** tabs, branch picker, command palette |
| Files | Virtualized file tree, go-to-file, project-wide search (case / regex), new / rename / delete files |
| Editor | CodeMirror 6 (same editor as the website) with syntax highlighting, tabs, undo/redo history per file, find & replace, word wrap, symbol bar for mobile keyboards, unsaved-draft protection |
| AI agent | Ask / Agent modes, @file mentions, photo & file attachments, plans you approve, live activity, tool log, proposed changes reviewed as diffs (accept / reject per file), task history, skills toggle |
| Preview | On this device: bundler for HTML / Vite / React / CRA projects (sucrase + esm.sh), fit / phone / desktop viewports, console, runtime & build errors with “Fix with AI”. **Live server**: Node projects with a `dev` or `start` script run in a temporary Vercel Sandbox through the Chrono backend (start / stop / reload / logs / open in browser) |
| Git | Diffs (unified, split on tablets), select files, generated commit messages, commit to a new branch or the current one, open PRs, recent commits, `.patch` export via the share sheet |
| Skills | Built-in and custom skills synced to your account |
| Settings | Theme, AI providers (OpenAI, Anthropic, Gemini, OpenRouter, compatible), **Integrations** (GitHub connection + where to review/revoke access), task history, backend status, sign out |

Local workspace state (edits, drafts, agent tasks) is saved on the device until you commit — the same model as the website's browser storage.

## Architecture

```
src/
  app/                 expo-router screens (tabs, project/[owner]/[repo], settings pages…)
  features/            feature modules ported from the website
    workspace/ agent/ git/ editor/ preview/ github/ ai/ skills/ history/ command/ dashboard/
  lib/                 API client (bearer token), storage, errors, agent tool schemas…
  stores/session.tsx   native GitHub OAuth + secure token storage
  ui/                  theme (Ember on Ink brand palette), component kit, vector brand mark
  generated/           editor + preview-runtime bundles (built by scripts/build-assets.mjs)
editor/                CodeMirror host that runs inside the editor WebView
```

The business logic (agent loop, tool execution, proposals, diffing, commit messages, preview bundler, project detection) is shared code copied from the website and covered by the same unit tests (`npm test`).

### Authentication

1. The app creates a PKCE verifier and opens `POST /api/auth/github/start` with `mobile: { redirectUri, codeChallenge }` in an auth session (`expo-web-browser`).
2. After GitHub, the API redirects to `chronoapp2://auth?handoff=…` (a short-lived sealed hand-off, no token in the URL).
3. The app exchanges the hand-off + verifier at `POST /api/auth/mobile/exchange` for a sealed session token, stored with `expo-secure-store` and sent as `Authorization: Bearer …`.

These endpoints live in the website repo, [`jazsajonia-pixel/chrono`](https://github.com/jazsajonia-pixel/chrono) (`netlify/functions/auth-*.ts`, served on Vercel through `api/`). The app never sees the GitHub token.

Session restore calls `GET /api/auth/session`. Since the website started pinning cookie sessions to one canonical host (Nov 2026), that endpoint can answer `{ authenticated: false, canonicalOrigin }` on other hosts; the app then retries once on that origin (https only, same parent domain) and keeps the stored token if the answer is anything but a definitive "signed out" (`src/lib/session-check.ts`).

### Brand and launch screen

Palette ("Ember on Ink"): Ink `#0B0D12`, Surface `#14181F`, Raised `#1C222B`, Ember `#FF7A3C` (primary accent), Mint `#3DDC97` (success only), Paper `#FAF8F5` (light background), Ember Deep `#C94A12` (light-theme accent). Small accent text in light mode uses `#B5420F` because Ember Deep on Paper is 4.43:1, just under WCAG AA. The mark (C-shaped ring + forward chevron) is vector source in `assets/brand/chrono-mark.svg` and `src/ui/brand.tsx`; `python3 scripts/make-icons.py` (needs `cairosvg`) regenerates the app icon, adaptive foreground/background, monochrome icon, splash image and favicon from it.

Launch: the native splash shows the mark on Ink; the JS launch screen (`src/features/shell/launch-screen.tsx`) keeps the mark in the same place, reveals the lowercase wordmark and runs a thin loading rail **only while startup work is pending** (fonts/theme/token, then session restore). It never adds delay, shows status after 1.6 s, offers "Continue without waiting" after 8 s on a slow restore, and is static when Android "Remove animations" is on.

### Project requirements and databases

A database is never required by Chrono. `src/features/project/requirements.ts` reads `package.json`, Prisma/Drizzle configs, migration folders, `.env.example` and a capped set of server/config files (names only, never values, nothing executed) and classifies the project: runs without a database, local SQLite, hosted service client (Supabase/Firebase), or needs a database connection. The Overview, the failed live-server screen and the agent (`inspect_package_json`, `request_preview`) show the result. Chrono does not provision databases or store database credentials; live-preview sandboxes currently start without environment variables.

### Live server preview

Server projects run remotely, never on the phone: the app posts the current workspace text files (including unsaved edits; ≤ 350 files / 1.8 MB, secrets and generated folders excluded) to `POST /api/preview-server`, polls `GET /api/preview-server`, and shows the sandbox URL in a WebView that can't navigate away from the sandbox origin. Contract and limits: [`docs/LIVE_SERVER_PREVIEW.md`](https://github.com/jazsajonia-pixel/chrono/blob/main/docs/LIVE_SERVER_PREVIEW.md) in the website repo.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go, or press i / a for a simulator
```

Every push to `main` builds a release APK in GitHub Actions (`.github/workflows/android-apk.yml`) and publishes it on [Releases](https://github.com/jazsajonia-pixel/chronoapp2/releases/latest) as `Chrono.apk`. Pull requests run typecheck, lint, tests, Expo Doctor and an Android bundle export (`.github/workflows/ci.yml`).

Builds with [EAS](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --profile preview --platform android   # installable APK
npx eas build --profile production --platform ios
```

### Configuration

The API defaults to `https://chrono-tau.vercel.app/api` (see `app.json → expo.extra`). Override with env vars:

```bash
EXPO_PUBLIC_CHRONO_URL=https://your-deploy.vercel.app
EXPO_PUBLIC_CHRONO_API=https://your-deploy.vercel.app/api
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (`eslint-config-expo`; React Compiler checks are warnings, see `docs/PARITY.md`) |
| `npm test` | Vitest unit tests (shared logic) |
| `npm run build:assets` | Rebuild `src/generated/*` (editor + preview runtime) after editing `editor/` or the runtime |

See [`docs/PARITY.md`](docs/PARITY.md) for the web ↔ mobile feature matrix and [`docs/TESTING.md`](docs/TESTING.md) for the device checklist.
