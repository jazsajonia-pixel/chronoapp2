# Testing Chrono mobile

## Automated (every PR, `.github/workflows/ci.yml`)

```bash
npm ci
npm run typecheck
npm run lint            # 0 errors required; warnings are tracked in docs/PARITY.md
npm test                # Vitest: shared logic, session restore, live-server file rules
npx expo-doctor
npx expo export --platform android --output-dir dist   # JS bundle compiles for Android
```

The APK workflow (push to `main`) runs typecheck and tests again before Gradle.

## Device checklist (Android first, ~4 GB RAM)

Record the device, Android version, APK tag and result for each line. Nothing here has been run for v1.1.0 yet.

| # | Area | Steps | Expected |
| --- | --- | --- | --- |
| 1 | Install | Install `Chrono.apk` over 1.0.0 | Upgrades in place (versionCode 2); new icon, themed icon on Android 13+ |
| 2 | Sign-in | Landing → Continue with GitHub → approve | Returns to Home signed in (this failed on 1.0.0 since 2026-11-04) |
| 3 | Session restore | Force-stop, reopen | Still signed in, no sign-in screen flash |
| 4 | Offline restore | Airplane mode, reopen | Landing shows an offline / backend error with Retry; after reconnecting, Retry restores the session without signing in to GitHub again |
| 5 | Logout | Settings → Sign out | Back to landing; reopening asks to sign in |
| 6 | Repos | Projects → search, filter, open a repo | Repository list loads and the workspace opens |
| 7 | Branches | Branch picker → switch | Tree reloads; edits on the old branch stay in that branch's workspace |
| 8 | Workspace tabs | Overview / Files / AI / Preview / Git | Each tab works; returning to a tab keeps its state |
| 9 | File tree | Expand folders, go-to-file, search | Smooth scrolling on a large repo |
| 10 | Editor | Edit, undo/redo, find & replace, symbol bar, keyboard open | Toolbar stays above the keyboard; 48 dp targets |
| 11 | Draft persistence | Edit, kill the app, reopen | Unsaved edit is still there and marked modified |
| 12 | AI agent | Agent mode task → review diff → reject one file, accept one | Only the accepted file changes |
| 13 | Preview (device) | Vite/React repo → Preview | Renders; runtime error shows "Fix with AI" |
| 14 | Preview (live) | Next.js or Express repo with a `dev` script → Preview | Auto-starts, "Live server ready", page loads; Stop works; logs open; external links open in the browser |
| 15 | Live server cleanup | Start live server, leave the project | Server is stopped (check the web Preview for the same repo shows idle/stopped) |
| 16 | Git | Commit to a new branch, open a PR | PR created; nothing discarded |
| 17 | Themes | Light, dark, system | All text readable in both |
| 18 | Reduced motion | Enable "Remove animations" | No looping animations except loading indicators |
