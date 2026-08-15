# GRIDDY

React + TypeScript + Vite + Tailwind app for building custom grid-question surveys and exporting them to Qualtrics (`.qsf` import or raw JS paste). See `README.md` for setup/scripts.

## Architecture

- `src/EditorContext.tsx` — single reducer (`editorReducer`) + React context holding the whole `GridConfig`. All editor UI dispatches typed actions here. `normalizeConfig` runs on every `setConfig` to keep `categoryMeta`/`responseLabelMeta` in sync with their CSV fields.
- `src/grid-types.ts` — canonical types. `GridConfig` = `LayoutConfig` + `TuningConfig` + `SurveyConfig` + optional `ExperimentalConfig`.
- `src/components/ConfigPanel.tsx` — the live editor UI (question/grid, categories, selection mode, experiment setup). This superseded the older `SurveyTab.tsx`/`LayoutTab.tsx`, which are dead code still sitting in the tree.
- `src/components/PreviewPanel.tsx` — interactive grid preview (paint/dropdown/dragdrop, experimental Setup/Respondent tabs) and the Export-to-Qualtrics modal.
- `src/lib/qualtricsExport.ts` — builds a self-contained vanilla-JS Qualtrics snippet, and a full `.qsf` (Qualtrics Survey Format) JSON document that Qualtrics can import directly (question + JS + embedded-data fields + survey flow, no manual setup).
- `src/lib/surveysApi.ts` — save/load/delete/export/import surveys, entirely via browser `localStorage` (key `griddy.localSurveys.v1`). Dedup on import via `surveyFingerprint` (stable JSON hash of name + config minus `id`).
- `src/pages/HistoryPage.tsx` ("My Surveys") — list/open/delete saved surveys, JSON export/import, multi-select `.qsf` export.

## Removed: sign-in / cloud accounts (2026-08-14)

Sign-in and Supabase-backed cloud sync were removed to simplify the app to a local-storage-only tool — no backend/database is needed anymore. This section exists so the feature can be reimplemented later without re-deriving the design.

**What existed before removal:**
- `src/lib/supabase.ts` — Supabase client, read `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from env.
- `src/lib/authContext.tsx` — `AuthProvider`/`useAuth()`, wrapping Supabase Auth (email/password sign in, sign up with first/last name metadata, sign out), backed by `supabase.auth.onAuthStateChange` + `getSession()`.
- `src/pages/AuthPage.tsx` — sign-in/sign-up form at `/auth`.
- `src/pages/ProfilePage.tsx` — profile view at `/profile` (name, email, saved-survey count).
- `src/components/AuthModal.tsx` — an unused NextUI-based modal variant of the same sign-in/sign-up form (was already dead code before removal).
- `App.tsx` header had a Sign In / avatar-initials-linking-to-profile / Sign Out cluster.
- `surveysApi.ts` functions (`saveSurvey`, `listSurveys`, `loadSurvey`, `deleteSurvey`, `exportSurveys`, `importSurveys`, `getActiveSurveyQuestionCount`) all took an optional `userId`: when present they read/wrote a Supabase `surveys` table (`id, user_id, name, config jsonb, created_at, updated_at`) instead of `localStorage`, so a signed-in user's surveys synced across devices.

**To reimplement:** restore the files above (recoverable from git history before this change), reintroduce `userId`-branching in `surveysApi.ts`, re-add the `surveys` Supabase table + RLS policy scoping rows to `auth.uid()`, add `@supabase/supabase-js` back to `package.json`, and restore `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars (local `.env` + Vercel project settings).

**What stayed:** all local-storage save/load/delete, JSON export/import (survey backups), and Qualtrics `.qsf`/JS export/download — none of that depended on auth.
