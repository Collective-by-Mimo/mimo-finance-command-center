# Mimo's Finance Command Center — TODO

## Foundation
- [x] Database schema: invoices, transactions, sync_logs, user_settings, users tables
- [x] Server-side DB query helpers (server/db.ts)
- [x] tRPC routers for all features (invoice, transaction, sync, ai, settings)
- [x] Design system: dark premium theme, OKLCH colors, DM Sans + JetBrains Mono typography

## Dashboard & Navigation
- [x] Mobile-first layout with bottom navigation (phone screens)
- [x] Sidebar navigation for desktop
- [x] Dashboard KPIs: total income, expenses, balance, pending invoices
- [x] KPI cards with trend indicators
- [x] Cash flow chart (Recharts, last 6 months)
- [x] Real-time sync status indicator with last sync time
- [x] Quick action buttons (New Invoice, Sync Gmail, Transactions, Settings)

## Transactions
- [x] Transaction list with search and filtering
- [x] Category tagging (income, expense, transfer)
- [x] Add/edit transaction form
- [x] Delete transaction

## Invoices
- [x] Invoice list view with filtering and search
- [x] Invoice detail view with PDF-style preview
- [x] Export/download invoice (print-to-PDF)
- [x] Secure file storage with persistent URLs for invoice PDFs (S3)
- [x] Invoice status management (draft, sent, paid, overdue, cancelled)
- [x] Create/update/delete invoices

## Gmail Scanner
- [x] Gmail integration via Google Apps Script proxy
- [x] LLM-based extraction of invoice fields (vendor, amount, date, line items)
- [x] Auto-create invoices from scanned emails
- [x] Duplicate detection via rawEmailId

## Google Sheets Ledger
- [x] Connect to Google Sheets via Apps Script
- [x] Import transactions from spreadsheet
- [x] Sync status tracking and history log

## AI Invoice Composer
- [x] Natural language prompt input
- [x] LLM generates structured invoice data
- [x] Invoice preview before saving
- [x] Save generated invoice to database
- [x] AI chat assistant for financial queries

## LLM Document Parsing
- [x] Upload invoice PDF/image (base64)
- [x] LLM extracts structured fields automatically
- [x] Review and confirm extracted data

## Notifications
- [x] Notify owner: new invoice detected (Gmail sync)
- [x] Notify owner: payment overdue (check overdue action)
- [x] Notify owner: sync error occurred

## Settings
- [x] Apps Script URL configuration
- [x] Google Sheets ID configuration
- [x] Default currency preference
- [x] User profile display

## Testing
- [x] Vitest tests: auth.logout (3 tests)
- [x] Vitest tests: invoice router auth guards (2 tests)
- [x] Vitest tests: transaction router auth guards (1 test)
- [x] Vitest tests: sync router auth guards (2 tests)
- [x] Vitest tests: settings router auth guards (1 test)
- [x] Vitest tests: ai router auth guards (1 test)
- [x] Vitest tests: input validation (3 tests)
- [x] Total: 14 tests passing

## Apps Script API Integration (Phase 2)
- [x] Wire Apps Script exact API contract (callAppsScript helper)
- [x] Map all 8 actions: getDashboard, getInvoices, processAi, generateInvoice, searchEmails, createDraft, draftFromInvoice, verifyGmail
- [x] Pre-fill Apps Script URL and Sheets ID in Settings (Mimo's known values)
- [x] Add verify connection button in Sync page (calls verifyGmail action)
- [x] Dual-mode AI Composer: Gemini via Apps Script + local LLM fallback
- [x] generateInvoice saves to Google Sheet AND local DB simultaneously
- [x] Sheets sync imports from INVOICES sheet using Apps Script getInvoices action
- [x] Proper error messages for deployment access issues (405, auth redirect)
- [x] AED as default currency throughout (matching Mimo's Config.gs)
- [x] Service categories from Config.gs shown in Composer as clickable badges

## Gmail Auto-Draft Feature
- [x] Auto-draft Gmail after invoice generation in Composer (calls createDraft action)
- [x] "Draft Email" button on Invoice Detail page for any existing invoice
- [x] Professional email body template with invoice details (number, client, amount, due date, line items)
- [x] Draft confirmation toast with link to Gmail
- [x] Handle missing Apps Script URL gracefully with fallback message
- [x] Explicit error handling in ComposerPage auto-draft: missing Apps Script URL, 405 deployment error, generic failure — all show user-facing warning toasts
- [x] Tests extended to 19 passing: createDraft auth, missing fields, Apps Script URL not configured, draftFromInvoice auth

## Bug Fixes (from live testing)
- [x] Fix Gmail sync: thread.getSnippet is not a function — root cause is inside Apps Script (GmailApp.search fails on some threads); added safeDateGmail helper; Apps Script fix provided to user
- [x] Fix Sheets ledger: DB insert fails — added safeDate() parser handling "YYYY-MM-DD HH:MM:SS.mmm" format; fixed source enum to "sheets"; safe amount parsing; fallback values for required fields
- [x] Update Apps Script searchEmails to safely wrap getSnippet() in try/catch — fix provided to user (see result message)
- [x] Add Gmail sync payload shape test to verify thread fields (id, subject, from, date, snippet) are present — 6 new tests, 25 total passing
