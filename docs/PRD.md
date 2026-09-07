# CashTrac v2 — Product Requirements Document

> Company finance for PT Fastrac Garda Indonesia (Nirmal — CEO, Shalfin — COO), without the spreadsheet dread.
> This document is the source of truth for what we're building, what's inherited from the legacy app, and what's left to do. New sessions: read this first, then `README.md`.

---

## 1. Vision

A financial tracker with a **smart, sexy UI** that makes managing company finances and accounting feel fun and intuitive instead of a chore. Plain Excel is boring; this should be the opposite — swipe to categorize, beautiful dashboards, and zero server to maintain.

**Key principles:**

- **Google Drive is the backend.** Ledger data lives in Google Sheets (always openable as raw sheets), raw statement files live in Drive as permanent reference.
- **No server, no database to maintain.** Client-side React app talking directly to Google APIs.
- **Workspaces = Drive folders.** PT Fastrac is one workspace (shared with both owners). Nirmal and Shalfin can each create private workspaces. **Access is enforced by Drive sharing** — an unshared folder is invisible/unreadable to the other person.
- **Duplicate-safe imports.** Weekly + monthly statements overlap naturally; fingerprints resolve duplicates.
- **Keyboard-first triage.** Categorizing transactions should feel like a game, not data entry.

---

## 2. Architecture

- **Stack:** Vite + React + TypeScript, Tailwind CSS v4, Google Identity Services (client-side OAuth), Google Sheets API v4 + Drive API v3, Framer Motion, PapaParse (CSV), SheetJS from CDN (xlsx), Phosphor icons, Geist fonts.
- **Why not AppSheet/Django:** AppSheet can't do the swipe UI, custom dedup logic, or a fast filterable ledger. Django adds a server + DB + hosting + auth maintenance for a 2-person company. A static React app reading/writing Sheets directly is the simplest thing that does everything.
- **Auth flow:** Google sign-in (popup) → token client (implicit flow, no backend) → app discovers/connects a workspace folder → reads that workspace's **Meta sheet** → reads one **ledger sheet per account**.
- **Scopes:** `spreadsheets` (read/write ledgers + meta), `drive.file` (create/upload raw statement files + workspace structure), `drive.readonly` (list folders, resolve ids, discover workspaces).

---

## 3. Workspace & data model

```
Drive/
└── one folder per workspace — sharing controls who can connect & read it

    Workspace: PT Fastrac  (shared with Nirmal + Shalfin)
    └── _cashtrac/
        ├── meta/Meta           ← spreadsheet: Accounts, Groups, Revenue tabs
        ├── ledgers/            ← one spreadsheet per account (Transactions + Imports tabs)
        └── statements/<account>/ ← raw uploaded statement files, kept as reference
```

**Meta spreadsheet tabs:**

- **Accounts:** `id, name, type (bank|ewallet|cash|gateway), owner, groupId, sheetId, currency, lastUpdated, lastTransactionDate, cadenceDays`
- **Groups:** `id, name, accountIds, owner`
- **Revenue:** `id, date, type (unearned|unbilled), description, amount, driveLink, note` — totals only, no lifecycle automation

**Ledger spreadsheet tabs:**

- **Transactions:** `date, description, category, amount, balance, source, sourceLink, fingerprint, importedAt, marked, invoiceLink, notes`
- **Imports (audit log):** `filename, rawFileLink, source, statementPeriod, importedAt, rowsFound, rowsNew, rowsDuplicate, rowsConflict`

**Money:** integer rupiah only. No float math anywhere. `parseAmountRupiah` strips symbols/commas → int.

---

## 4. Import + dedup (critical logic)

1. User picks account → uploads statement (CSV/xlsx now; **PDF = raw-reference only** in v1).
2. **Raw file uploaded to Drive first** (`_cashtrac/statements/<account>/<date>-<filename>`) — permanent reference, even if unparsed. Drive link recorded on Imports log + each imported row.
3. Parse (PapaParse for CSV; SheetJS from `https://cdn.sheetjs.com` pinned — **never** npm `xlsx`, stale & vulnerable).
4. Normalize: trim/lowercase description, collapse spaces, coerce dates to `YYYY-MM-DD`, amount to integer.
5. **Fingerprint** per row: `hash(date | amount | normalizedDescription | balance?)` (balance only when statement provides running balance).
6. Dedup against the account's existing Transactions **and** within the file. Weekly-then-monthly overlap resolves naturally.
7. Classify: **new / duplicate / conflict** (same fingerprint, different data → review).
8. Batch append new rows (single `values.append`), write Import log row, update `lastUpdated` + `lastTransactionDate`.
9. Re-uploading the identical file = no-op.

---

## 5. Screens & features

| Screen | Status | Notes |
|---|---|---|
| **Login** | ✅ Done | Branded Google sign-in, split-screen |
| **Workspace switcher** | ✅ Done | Connect via Drive folder link, in topbar + Settings |
| **Setup wizard** | ✅ Done | Verify folder → create `_cashtrac` structure + Meta spreadsheet |
| **Dashboard** | ✅ Done | Bento grid: positions, revenue, attention, accounts strip, recent tx |
| **Accounts** | ✅ Done | Card grid, institution icons, Live/Sync Needed/Manual Vault pills |
| **Transactions** | ✅ Done | Filterable ledger, inline category edit, category color dots |
| **Swipe/triage deck** | ✅ Done | Keyboard-first: 1-9 categorize, Enter approve, Backspace skip |
| **Revenue** | ✅ Done | Totals-only unearned + unbilled, +/- inline add |
| **Settings** | ✅ Done | Workspace management, mode, sign out |
| **Statement import UI** | ⏳ Pending | Dropzone + tally report (see §7) |
| **Invoice linker** | ⏳ Pending | Drive search + attach to transaction |
| **Cash vault** | ⏳ Pending | Manual cash entries + paired transfers |
| **Stale warning banner** | ⏳ Pending | Dashboard-level "statement overdue" callout |

---

## 6. Legacy app analysis (inheritance log)

We analyzed the legacy app at `../CashTrac` (Next.js + better-sqlite3 + xlsx npm). It had genuinely great interactions. **v1 was "inherently broken" because of its stack (server + SQLite + vulnerable xlsx), not its UI.** We inherit the good UI, not the bad stack.

### Inherited into v2 ✅

- **Keyboard-first triage** — 1-9 categorize, Enter/→ approve, Backspace/← skip, `I` invoice. Card-replacement flow (not drag), spring `stiffness: 350, damping: 26`.
- **Category system** — 9 categories with `key` (1-9), `color`, `type` (expense/income/both). `src/lib/categories.ts`.
- **Account status pills** — Live / Sync Needed (7-day staleness) / Manual Vault, on account cards.
- **Account card layout** — institution icon, balance, account owner line, per-card "Statement +" action, border-t footer with latest tx.
- **Inbox Zero celebration** — done state is a moment, not a blank box.
- **Inflow/Outflow badge** — income/expense pill on triage cards.

### On the list to inherit (pending) ⏳

- **Mathematical Tally & Continuity Report** — the upload flow's trust moment: `Saldo Awal + Inflows − Outflows = Saldo Akhir` with a Tallied/Mismatch badge + continuity-gap warning. Build into the import pipeline.
- **Invoice attach status row** on triage cards + a Drive-search invoice linker modal.
- **Cash vault modal** — movement-type selector (Petty Cash Expense / Cash Received / Deposit to Bank / Withdraw from Bank) with **paired internal transfer** so deposits/withdrawals don't double-count.
- **True Working Capital** dashboard metric — `liquid − unearned + unbilled`, and **True Runway** (`liquid / monthly burn`).

### Deliberately NOT inherited ❌

- `better-sqlite3` + Next server (v2 is client-side, Sheets-as-DB)
- npm `xlsx` package (stale + known CVEs; SheetJS from CDN instead)
- `parseFloat` money math (v2: integer rupiah)
- Native `confirm()` dialogs (v2: toasts + inline UI)
- Generic zinc/emerald default theme (v2 has the polished Geist/teal system)

---

## 7. Roadmap (phases + status)

| Phase | Description | Status |
|---|---|---|
| 0 | Google setup docs + README checklists | ✅ |
| 1 | Scaffold (Vite + React + TS + Tailwind v4, fonts, palette, shell, login) | ✅ |
| 2 | Data layer (gapi, sheets, drive, meta, ledger, fingerprint, import, money, cache + mock mode) | ✅ |
| 3 | Setup wizard (connect workspace, create `_cashtrac`, groups) | ✅ |
| 4 | Dashboard bento grid | ✅ |
| 5 | Import pipeline + dedup review + raw file storage | ⏳ Next |
| 6 | Swipe deck | ✅ (rebuilt keyboard-first, inherited from legacy) |
| 7 | Revenue + Transactions | ✅ |
| 8 | Workspace polish (switching, connect/disconnect, access errors) | ⏳ |
| 9 | Polish (states, mobile, perf, a11y) | ⏳ |
| 10 | Ship (deploy, dogfood, acceptance test) | ⏳ |

### Next up (Phase 5 — import pipeline)

- `StatementDropzone` modal — drag-drop multiple files, account target selector (auto-detect later), accept `.xlsx,.xls,.csv,.pdf,.txt`.
- Parse → fingerprint → dedup (already built: `lib/fingerprint.ts`).
- Upload raw file to Drive first (`lib/drive.ts: uploadFile`).
- **Tally report** — Saldo Awal / + Inflows / − Outflows / = Saldo Akhir, Tallied or Mismatch badge, continuity-gap warning, "+N new • M duplicates skipped".
- PDF → store raw, log unparsed, flag "needs manual entry".

---

## 8. Design system

- **Tuning:** DESIGN_VARIANCE 6 · MOTION 6 · VISUAL_DENSITY 5
- **Palette:** zinc-950 surfaces (never pure black), emerald pos / rose neg, teal accent, no purple
- **Type:** Geist + Geist Mono; every number in mono (`tnum`)
- **Surfaces:** cards only where elevation means something; `rounded-[2rem]`, 1px borders, diffusion shadow
- **Motion:** Framer springs (`stiffness: 100, damping: 20`), `AnimatePresence`, staggered reveals; perpetual animations isolated in memoized leaf components
- **States:** skeleton loaders, beautiful empty states, inline errors, `scale-[0.98]` tactile feedback
- **Icons:** Phosphor only. **No emojis anywhere.**
- **Responsive:** strict single-column below `md`, `min-h-[100dvh]`, `max-w-7xl mx-auto`

---

## 9. Commands & conventions

```bash
env -u NODE_ENV npm run dev      # dev server (NODE_ENV=production blocks devDeps!)
env -u NODE_ENV npm run build    # typecheck + production build
env -u NODE_ENV npm run lint     # oxlint
```

- **Commit discipline:** commit after each phase, not all-at-once.
- **TypeScript strict:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` — unused imports fail the build.
- **Phosphor icon names differ from Lucide** — check exports before importing.
- Google APIs load from CDN (no npm package); SheetJS from `cdn.sheetjs.com`, never npm `xlsx`.

---

## 10. Open questions / decisions

- **PDF parsing** is deferred to a future phase (pdf.js + per-bank layout configs). v1 stores PDFs raw + flags manual entry.
- **Invoice linker** needs a Drive folder to search — likely the workspace's `statements/` + an `invoices/` folder (TBD where invoices live).
- **Category list** is fixed at 9 for now (inherited). Should it be per-workspace editable?
- **Staleness cadence** is per-account `cadenceDays` (7 default). Weekly vs monthly accounts need different defaults at creation.
- Deploy target: Vercel static (spa). Register the production origin in the OAuth client when we ship.
