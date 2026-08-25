# CashTrac v2

Company finance for PT Fastrac Garda Indonesia — without the spreadsheet dread.

A client-side financial tracker (Vite + React + TypeScript) that uses **Google Sheets as the database** and **Google Drive as the file layer**. No server, no database to maintain — your data lives in your own Drive, always openable as raw sheets.

## How it works

- **Workspace = one Drive folder.** PT Fastrac is a workspace; Nirmal and Shalfin can each create private workspaces. Access is enforced by Drive sharing — an unshared workspace is simply invisible to the other person.
- The app connects to a workspace, reads a central **Meta sheet** (accounts, groups, revenue), and one **ledger sheet per account**.
- **Statement imports** upload the raw file to `_cashtrac/statements/<account>/`, fingerprint each row (`date | amount | description | balance?`), dedupe against the ledger, and batch-append. Weekly + monthly statements for the same account just work — overlapping rows resolve to duplicates.
- **PDFs**: stored as raw reference + flagged for manual entry in v1 (parsing is a future phase).
- **Revenue**: totals-only tracking of unearned and unbilled revenue.
- **Swipe deck**: unmarked transactions as a Tinder-style stack — swipe right to categorise, left to skip.

## Getting started

```bash
# NODE_ENV must not be 'production' when installing (npm skips devDeps otherwise)
env -u NODE_ENV npm install
env -u NODE_ENV npm run dev
```

Open http://localhost:5173. Without a Google client id the app runs in **mock mode** with sample data so you can explore the UI.

## Phase 0 — Google Cloud setup (required for live mode)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (e.g. `cashtrac`).
2. **Enable APIs** → Google Sheets API + Google Drive API.
3. **OAuth consent screen** → External (or Internal if you're on Google Workspace), add Nirmal + Shalfin as test users.
4. **Credentials** → Create credentials → OAuth client ID → Web application:
   - Authorized JavaScript origins: `http://localhost:5173` (dev) and your deployed URL (e.g. `https://cashtrac.vercel.app`).
5. Copy the client id and create `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

6. Restart the dev server. Sign-in now hits the real Google consent flow.

### Scopes requested

- `spreadsheets` — read/write ledgers + meta
- `drive.file` — create/upload raw statement files + workspace structure
- `drive.readonly` — list folders, resolve ids, discover workspaces

## Workspace setup (after signing in)

1. In Drive, create a folder for the workspace (e.g. `PT Fastrac`) and share it with the other owner.
2. In the app → workspace switcher → **Connect**, paste the folder link.
3. The app creates the `_cashtrac/` structure: `meta/Meta` spreadsheet (Accounts, Groups, Revenue tabs), one ledger spreadsheet per account, and a `statements/` folder per account.

## Scripts

```bash
env -u NODE_ENV npm run dev      # dev server
env -u NODE_ENV npm run build    # typecheck + production build
env -u NODE_ENV npm run lint     # oxlint
env -u NODE_ENV npm run preview  # preview the production build
```

## Tech notes

- **Tailwind v4** via `@tailwindcss/vite` (no postcss plugin needed).
- **Fonts**: Geist + Geist Mono via Fontsource, numbers always render in mono.
- **CSV** parsing via PapaParse; **xlsx** via SheetJS pinned from `https://cdn.sheetjs.com` — the npm `xlsx` package is stale and has known vulnerabilities, don't use it.
- **Google APIs** load from CDN (`gsi/client` + `apis.google.com/js/api.js`) — no npm package.
- Money is stored as **integer rupiah** — no float math anywhere.
