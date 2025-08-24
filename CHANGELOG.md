# Change Log
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
