# Finance Command Center — Consolidation / Migration Report

Date: 2026-07-29

## 1. Original repositories analyzed

| Repo | Stack | Commits | Status found |
|---|---|---|---|
| `mimo-finance-command` | React + tRPC/Express + Drizzle ORM (Postgres) | 5 | Clean, up to date with origin |
| `mimo-finance-command-center` | Same stack, later state | 6 | Clean, up to date with origin |
| `Mimo-s-Finance-Command-Center` | Google AI Studio prototype: React/Firebase frontend + Google Apps Script backend | 2 original + follow-up commits (redaction, archive marking) | Clean except a structural case-collision artifact (see below), left untouched |

Key finding: `mimo-finance-command`'s HEAD (`acf2c42`) is a direct git ancestor of
`mimo-finance-command-center`'s HEAD — verified with
`git merge-base --is-ancestor`. The newer repo is that exact history plus one
commit (`d0290ce`) adding `.env.example`, `README.md`, and a longer `todo.md`.
`mimo-finance-command` therefore contains zero unique code.

`Mimo-s-Finance-Command-Center` is architecturally distinct: it bundles (a) a
React/Firebase frontend prototype and (b) a Google Apps Script Web App backend
(`Code.gs` + service files). The Apps Script action names
(`getDashboard`, `getInvoices`, `processAi`, `generateInvoice`, `searchEmails`,
`createDraft`, `draftFromInvoice`, `verifyGmail`) match exactly what
`mimo-finance-command-center`'s commit `49e4ad8` describes wiring up on the
client/server side, confirming this Apps Script code is the live backend that
repo's Gmail scanner and Sheets sync depend on — not a competing/superseded
implementation.

`Mimo-s-Finance-Command-Center` also tracks two paths that differ only by case
— `Index.html` (the Apps Script `doGet()` bridge page) and `index.html` (the
Vite app's real entry point). Windows' filesystem is case-insensitive, so both
map to one physical file; whichever blob was checked out last shadows the
other and git perpetually reports one of the two as locally modified. This
predates the migration, is not fixable without restructuring that repo's
tracked paths, and does not affect this repo — noted here for the record.

## 2. Final repository selected

**`mimo-finance-command-center`** (this repo) — most mature architecture
(tRPC + Express + Drizzle/Postgres server, polished React/shadcn client,
25 passing Vitest tests before this migration), and already the de facto
consolidation target per its prior README.

## 3. Components migrated

From `Mimo-s-Finance-Command-Center` into `apps-script/` in this repo:
- `Code.gs`, `Config.gs`, `Constants.gs`, `DashboardService.gs`,
  `GmailService.gs`, `InvoiceService.gs`, `Repository.gs`, `Schema.gs`,
  `AiService.gs`, `appsscript.json`, `Index.html` (the `doGet()` bridge page —
  originally missed in the first migration pass, added after verification
  caught that `Code.gs` references it via `createTemplateFromFile('Index')`
  with no matching file in `apps-script/`)

This is the Google Apps Script Web App that this app's Settings-configured
`APPS_SCRIPT_URL` calls for Gmail search/draft creation and Sheets ledger
read/write. It runs on Google's infrastructure and cannot be merged into the
Node app itself; it's preserved here as source-of-truth alongside the app that
depends on it.

Nothing was migrated from `mimo-finance-command` — see §1, it has no unique
commits.

## 4. Components archived (not migrated, not deleted)

- **`mimo-finance-command`** (entire repo) — superseded, zero unique code.
  Marked with `ARCHIVED.md`, left in place.
- **`Mimo-s-Finance-Command-Center`**'s React/Firebase frontend prototype
  (`src/App.tsx`, `src/components/InvoicePreview.tsx`, `src/lib/firebase.ts`,
  `server.ts` Express proxy, `firebase.json`, `firestore.rules`,
  `.firebaserc`) — functionally superseded by this repo's `client/` (full
  Dashboard, Invoices, Composer, Sync, Settings pages) and `server/`
  (tRPC router, Drizzle-backed storage). Left in place in the archived repo,
  not merged, per the working rule against blind rewrites — it was already a
  prototype, not a production path.

## 5. Components removed and why

None removed from this repo's working tree. No in-repo duplication was found
that required deletion — the duplication was across repos, and is resolved by
archiving rather than removing (per "archive repos must not be deleted").

## 6. Security fixes applied

1. **Exposed Apps Script deployment URL**: `Mimo-s-Finance-Command-Center/.env.example`
   contained a real, non-placeholder Apps Script Web App URL. Redacted to a
   placeholder in commit `2fca93d` (that repo). The old URL must still be
   treated as compromised since it was live in git history before redaction —
   rotate/revoke the deployment in the Apps Script console.
2. **Hardcoded Sheet ID**: `Config.gs`'s `getSpreadsheetId()` silently defaulted
   to a real, hardcoded Google Sheet ID if no Script Property was set. Changed
   to throw an error requiring explicit configuration. Applied to both the
   archived repo (commit `2fca93d`) and the migrated copy in `apps-script/`.
3. **No authentication on the Apps Script Web App**: `appsscript.json` sets
   `"access": "ANYONE_ANONYMOUS"`, and `Code.gs`'s `doPost`/`apiHandler` performs
   no auth check before dispatching to Gmail/Sheets/AI actions — despite
   `DIAGNOSTICS.md` (in the archived repo) claiming an API key check exists.
   **Not fixed by this migration** — this requires deploying new code to Google's
   servers, which only the account owner can do. See
   `apps-script/README.md` in this repo for the required steps (add a
   shared-secret check to `doPost`, rotate the deployment).

## 7. Final architecture

```
mimo-finance-command-center/
├── client/          React 19 + shadcn/Radix UI, wouter router, tRPC client
├── server/          Express + tRPC router, Drizzle ORM (Postgres), S3 storage
├── drizzle/          Schema/migrations
├── apps-script/      Google Apps Script Web App backend (Gmail + Sheets bridge)
│                      — deployed separately to script.google.com, called via
│                      the URL configured in the app's Settings page
├── docs/
│   └── MIGRATION_REPORT.md   (this file)
└── ...config files (vite, drizzle, tsconfig, etc.)
```

The app itself is a single deployable Node service (`pnpm dev` / `pnpm build`
+ `pnpm start`). The Apps Script component is a second, independently
deployed piece (Google's infra) that the Node app calls over HTTP — this is
an architectural requirement (Gmail/Sheets access has to run as Apps Script),
not a leftover duplication.

## 8. Remaining risks

- **Apps Script deployment not yet rotated.** The old URL is still live
  until you revoke/replace it in the Apps Script console — see
  `apps-script/README.md`.
- **No auth on the Apps Script endpoint.** Until a shared-secret check is
  added to `doPost`, whoever has the current (or any future) deployment URL
  can call all 8 actions, including creating Gmail drafts, with no
  credentials.
- **Archived repos still contain the old secrets in git history.** Per your
  instructions, history was not rewritten and nothing was force-pushed —
  `mimo-finance-command`'s and `Mimo-s-Finance-Command-Center`'s full commit
  history (including the pre-redaction secret) remains intact on GitHub.
  If that's unacceptable, that needs a separate, explicitly-approved history
  rewrite + force-push.
- **Build verified.** `pnpm install`, `tsc --noEmit` (0 errors), `vitest`
  (25/25 passing), and `vite build` all succeed as of the final pre-push
  check on 2026-07-29. The Apps Script files don't affect the Node build —
  they're plain files, not part of the TypeScript project.
- **GitHub-level "archived" status not set.** `ARCHIVED.md` marks intent in
  both archive repos, but the actual GitHub "Archive this repository"
  read-only toggle (Settings → General → Danger Zone) was not flipped — no
  CLI credentials were available to do this from here. Recommend doing that
  manually once you're satisfied with the migration.
