# Mimo Finance Command Center

Personal finance and invoicing command center for Movsum (Mimo) Mirzazada: scan Gmail for bills, keep a Google Sheets ledger in sync, compose invoices with AI, and track transactions — all in one dashboard.

## What is inside

- **Dashboard** — KPI cards and cash-flow chart
- **Invoices** — create, upload, preview and export PDF invoices
- **AI Composer** — dual-mode AI invoice composer (Gemini via Apps Script, or local LLM)
- **Gmail scanner** — pulls billing emails through a Google Apps Script bridge
- **Sheets sync** — two-way sync with the Google Sheets ledger, with sync history
- **Transactions** — full transaction management
- 25 passing Vitest tests (`pnpm test`)

## Stack

React client (`client/`) + tRPC/Express server (`server/`) + Drizzle ORM (`drizzle/`, PostgreSQL). S3-compatible storage for uploads. pnpm workspace with a patched wouter router. The Gmail/Sheets bridge is a separate Google Apps Script Web App (`apps-script/`), deployed independently to script.google.com.

## Run it

```
corepack enable        # once, to get pnpm
pnpm install
pnpm dev               # app on http://localhost:3000
pnpm test              # run the test suite
```

Copy `.env.example` to `.env` and fill in the values (see comments). The Gmail/Sheets Apps Script URL is configured in the app's Settings page.

## History

This is the authoritative Finance Command Center repo. Two other repos are archived (kept for history, not deleted, not active):

- [`mimo-finance-command`](https://github.com/Collective-by-Mimo/mimo-finance-command) — the base this repo was consolidated from in July 2026 (all local differences were line-endings only, plus a longer `todo.md`). Fully absorbed; its full commit history is an ancestor of this repo's.
- [`Mimo-s-Finance-Command-Center`](https://github.com/Collective-by-Mimo/Mimo-s-Finance-Command-Center) — the original Google AI Studio prototype. Its React/Firebase frontend is superseded by this repo's `client/`, but its **Apps Script backend was migrated here** (`apps-script/`) — it's the live code behind the Gmail scanner and Sheets sync, not dead weight.

See `docs/MIGRATION_REPORT.md` for the full consolidation record, including a security fix applied during migration (a previously-exposed Apps Script deployment URL).
