# Change Log
## [0.0.5] LUMINA 2025-09-02
### Updates
- Upload Documents UI: removed page-local header; matched layout with `DocumentVisibility` (container, title, subtext, card styling). Dropped `onBack` prop (`src/UploadPage.tsx`, `src/App.tsx`).
- Navigation labels: renamed "Upload Files" to "Upload Documents" in mobile drawer and desktop sidebar (`src/App.tsx`).
- Chat session management: regenerate `userId` on login and logout; persist to `localStorage`; `window.getUserId()` returns current value (`src/App.tsx`).
- Chat clearing on auth change: reset messages to default greeting on login and logout (`src/App.tsx`).
- Chat → n8n integration: include `sessionId` and `userId` in body; added optional `accessToken` body support earlier and finally standardized to body token with CORS guidance; added/removing headers as requested across iterations (`src/App.tsx`).
- Build optimizations: lazy-load `react-markdown`, dynamic-import `exceljs`, wrap markdown in `Suspense`, and remove `eval` from JSON parsing (`src/App.tsx`).
- Removed `AdminConsole.tsx` file and all references; ensured no traces remain (`src/App.tsx`).

## [0.0.4] LUMINA 2025-08-30
### Updates
- fix build error

## [0.0.3] LUMINA 2025-08-30
### Updates
- Created `DocumentVisibility` admin page to manage `documents.visibility` with a per-row dropdown (public_theory, user, admin). Renders inside the main layout and is admin-only (`src/DocumentVisibility.tsx`, `src/App.tsx`).
- Integrated page into mobile drawer and desktop left nav; entries are visible only for admins (`src/App.tsx`).
- Removed Admin Console page and its navigation links from both mobile and desktop (`src/App.tsx`).

## [0.0.2] LUMINA 2025-08-30
### Updates
- Kept header and left navigation persistent across pages; ensured `UploadPage` and `AdminConsole` render inside the main layout (`src/App.tsx`).
- Added active-state highlighting for mobile drawer and desktop left nav items (`src/App.tsx`).
- Added account footer in mobile drawer showing avatar initial, email, role badges, plus Copy email and Sign out actions (`src/App.tsx`).
- Added account footer in desktop left sidebar to mirror mobile account chip (`src/App.tsx`).
- Enforced RBAC on navigation and routes: hide Upload Files and Admin Console menu entries for non-admin users; non-admin direct visits show an "Admin only" message (`src/App.tsx`).
- Floating chat input: fixed to bottom and centered within the content area; offsets respect left nav width and the right news panel; adjusted z-index so the mobile drawer overlays the input (`src/App.tsx`).
- Send button: switched icon to paper airplane and adjusted vertical alignment for optical centering (`src/App.tsx`).
- User message avatar: now matches the hamburger/profile chip style (light background, gray initial) and uses the email initial when available (`src/App.tsx`).
- Collapsed sidebar spacing: centered icons and normalized left/right padding for a symmetrical look (`src/App.tsx`).

## [0.0.1] LUMINA 2025-08-24
### Updates
- Added Upload Files page to upload to Supabase Storage bucket `documents` (`src/UploadPage.tsx`).
- Initialized Supabase client (`src/lib/supabaseClient.ts`).
- Implemented email/password auth modal with Register and Sign in; added Sign out; wired auth state updates (`src/App.tsx`).
- Added “Upload Files” entry to the hamburger menu (`src/App.tsx`).
- Header now shows app version from `package.json`; enabled JSON imports (`tsconfig.app.json`).
- Restructured layout: full-width header; removed HISTORY; moved “BERITA HARI INI” to right; mobile sidebar slides from right (`src/App.tsx`).
- Dependency updates: added `@supabase/supabase-js@^2.56.0`; added npm overrides for `@isaacs/cliui`→`wrap-ansi-cjs@8.0.0`; refreshed lockfile.
- Note: Storage policy “Upload to documents” created in Supabase to allow inserts for authenticated users only (server-side change).
