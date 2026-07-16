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

React client (`client/`) + tRPC/Express server (`server/`) + Drizzle ORM (`drizzle/`, PostgreSQL). S3-compatible storage for uploads. pnpm workspace with a patched wouter router.

## Run it

```
corepack enable        # once, to get pnpm
pnpm install
pnpm dev               # app on http://localhost:3000
pnpm test              # run the test suite
```

Copy `.env.example` to `.env` and fill in the values (see comments). The Gmail/Sheets Apps Script URL is configured in the app's Settings page.

## History

Consolidated July 2026 from the org repo `mimo-finance-command` (base — all 131 apparent local differences were line-endings only) plus the longer local `todo.md` roadmap. The older Apps Script/Firebase variant (`Mimo-s-Finance-Command-Center`) was not merged; it is superseded by this app.
