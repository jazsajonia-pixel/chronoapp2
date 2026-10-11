# Chrono for iOS and Android

Chrono's native companion app brings the mobile-first GitHub coding workspace to iOS and Android. Built with Expo, React Native, and `expo-router`, it uses native screens rather than wrapping the web app.

The app connects to the shared Chrono API and Neon Postgres database, so accounts, AI provider settings, skills, and workspace data stay in sync with the web experience.

## Features (parity with the website)

| Area | What you get |
| --- | --- |
| Sign-in | GitHub OAuth in the system browser (PKCE), session stored in the iOS Keychain / Android Keystore |
| Home | Recent projects, quick actions, active AI provider, backend status |
| Projects | Your GitHub repositories with search, filters, pagination, and **New repository** |
| Workspace | Per-repo **Overview** dashboard, **Files**, **AI**, **Preview**, **Git** tabs, branch picker, command palette |
| Files | Virtualized file tree, go-to-file, project-wide search (case / regex), new / rename / delete files |
| Editor | CodeMirror 6 (same editor as the website) with syntax highlighting, tabs, undo/redo history per file, find & replace, word wrap, symbol bar for mobile keyboards, unsaved-draft protection |
| AI agent | Ask / Agent modes, @file mentions, photo & file attachments, plans you approve, live activity, tool log, proposed changes reviewed as diffs (accept / reject per file), task history, skills toggle |
| Preview | In-app bundler for HTML / Vite / React / CRA projects (sucrase + esm.sh), fit / phone / desktop viewports, console, runtime & build errors with “Fix with AI” |
| Git | Diffs (unified, split on tablets), select files, generated commit messages, commit to a new branch or the current one, open PRs, recent commits, `.patch` export via the share sheet |
| Skills | Built-in and custom skills synced to your account |
| Settings | Theme, AI providers (OpenAI, Anthropic, Gemini, OpenRouter, compatible), task history, backend status, sign out |

Local workspace state (edits, drafts, agent tasks) is saved on the device until you commit — the same model as the website's browser storage.

## Architecture

```
src/
  app/                 expo-router screens (tabs, project/[owner]/[repo], settings pages…)
  features/            feature modules ported from the website
    workspace/ agent/ git/ editor/ preview/ github/ ai/ skills/ history/ command/ dashboard/
  lib/                 API client (bearer token), storage, errors, agent tool schemas…
  stores/session.tsx   native GitHub OAuth + secure token storage
  ui/                  theme (same HSL palette as the website), component kit, brand marks
  generated/           editor + preview-runtime bundles (built by scripts/build-assets.mjs)
editor/                CodeMirror host that runs inside the editor WebView
```

The business logic (agent loop, tool execution, proposals, diffing, commit messages, preview bundler, project detection) is shared code copied from the website and covered by the same unit tests (`npm test`).

### Authentication

1. The app creates a PKCE verifier and opens `POST /api/auth/github/start` with `mobile: { redirectUri, codeChallenge }` in an auth session (`expo-web-browser`).
2. After GitHub, the API redirects to `chronoapp2://auth?handoff=…` (a short-lived sealed hand-off, no token in the URL).
3. The app exchanges the hand-off + verifier at `POST /api/auth/mobile/exchange` for a sealed session token, stored with `expo-secure-store` and sent as `Authorization: Bearer …`.

These endpoints live in the `mobdevai` repo (branch `mobile-app-auth`); they must be deployed for sign-in to work.

## Run it

```bash
npm install
npx expo start          # scan the QR code with Expo Go, or press i / a for a simulator
```

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
| `npm test` | Vitest unit tests (shared logic) |
| `npm run build:assets` | Rebuild `src/generated/*` (editor + preview runtime) after editing `editor/` or the runtime |
