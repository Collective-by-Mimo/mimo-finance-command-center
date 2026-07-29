# Apps Script backend

This is the Google Apps Script Web App that the main app's Gmail scanner and Sheets
ledger sync depend on. It runs on Google's infrastructure (not in this Node app) and
is deployed separately from `script.google.com`. It implements the 8 actions the
client/server call: `getDashboard`, `getInvoices`, `processAi`, `generateInvoice`,
`searchEmails`, `createDraft`, `draftFromInvoice`, `verifyGmail`.

Migrated from the `Mimo-s-Finance-Command-Center` repo on 2026-07-29 — see
`/docs/MIGRATION_REPORT.md` at the repo root for the full consolidation record.
The React/Firebase frontend prototype that repo also contained was **not** migrated;
it's superseded by this repo's `client/`.

## ⚠️ Security — rotate before redeploying

The previous deployment (`AKfycbyJPh...`) was committed to git in cleartext in
`Mimo-s-Finance-Command-Center/.env.example`, and `appsscript.json` sets
`"access": "ANYONE_ANONYMOUS"` with **no auth check** in `Code.gs`'s `doPost`/
`apiHandler`. Anyone with that URL could read dashboard/invoice data, search Gmail,
and create Gmail drafts. Treat the old URL as burned. Before pointing this app's
Settings page at a live deployment again:

1. In the Apps Script editor, go to **Deploy → Manage deployments**, and either
   **archive/revoke the old deployment** or create a brand-new one — either way, the
   old URL must stop working.
2. Add a shared-secret check to `doPost` in `Code.gs` before dispatching to
   `apiHandler` (e.g. require a header or `data.apiKey` matching a value stored in
   `PropertiesService.getScriptProperties()`), so anonymous requests are rejected.
3. Deploy, copy the **new** Web App URL (ends in `/exec`), and paste it into this
   app's Settings page — do not commit it to any `.env` file that gets tracked by git.

## Deploying

1. Install the [clasp CLI](https://github.com/google/clasp) or paste these files
   manually into a new Apps Script project at script.google.com.
2. In the Apps Script project's **Project Settings → Script Properties**, set:
   - `GEMINI_API_KEY` — your Gemini API key
   - `SPREADSHEET_ID` — the Google Sheet ID used as the ledger (required; there is
     no hardcoded fallback anymore, see below)
3. Run `runSetup` once manually from the Apps Script editor to grant Gmail/Sheets
   permissions.
4. Deploy as a Web App (see security steps above for access settings).

## Files

| File | Purpose |
|---|---|
| `Code.gs` | Entry point (`doGet`/`doPost`) and the `apiHandler` action router |
| `Index.html` | Placeholder page `doGet()` serves for browser (non-API) visits to the deployment URL |
| `Config.gs` | Script properties access (API key, spreadsheet ID), operator/business info used on invoices |
| `Constants.gs` | Shared constants |
| `Schema.gs` | Spreadsheet ledger schema setup |
| `Repository.gs` | Reads/writes ledger records |
| `DashboardService.gs` | Aggregates dashboard KPI data |
| `InvoiceService.gs` | Invoice creation/preview |
| `GmailService.gs` | Gmail search, draft creation, invoice-to-draft |
| `AiService.gs` | Gemini prompt processing |
| `appsscript.json` | Apps Script manifest (timezone, web app access mode) |

`Config.gs`'s `getSpreadsheetId()` previously hardcoded a real Sheet ID as a silent
fallback; it now throws if `SPREADSHEET_ID` isn't explicitly set in Script Properties.
