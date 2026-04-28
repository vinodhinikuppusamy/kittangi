# Workspace

## Overview

pnpm workspace monorepo for **Kittangi OS** — a Multi-Vertical Financial Management System covering Pawn Broking and Vehicle Finance.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui-ready primitives
- **Routing**: react-router-dom v6
- **Icons**: lucide-react
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (not yet used)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/kittangi-os` — main React + Vite frontend, served at `/`.
- `artifacts/api-server` — shared Express API, served at `/api`.
- `artifacts/mockup-sandbox` — design sandbox (canvas previews).

## Kittangi OS Frontend

Brand palette (CSS variables in `artifacts/kittangi-os/src/index.css`):

- `--bg-main: #E9F4FB` (Sky Mist) — main app background
- `--sidebar-bg: #FFFFFF` — sidebar background
- `--brand-primary: #4A6FA5` (Indigo) — active states, headers, primary buttons
- `--brand-accent: #89CFF0` (Powder Blue) — highlights / secondary
- `--brand-light: #BFDDF5` (Soft Azure) — hover states
- `--text-main: #030213`
- `--text-muted: #64748B`

Layout:

- `src/components/Layout.tsx` — fixed 64px header + 256px sidebar with App Switcher.
- `activeVertical` is local React state in `Layout` (`'PAWN' | 'VEHICLE'`) controlling the dynamic sidebar.
- Header has global search, bell with notification dot, and Admin User badge.

Navigation (`src/lib/navigation.ts`):

- PAWN: Dashboard, Global Customers, Pawn Origination, Pledged Items, Vault Management, Receipts & Ledger, Daybook (Chitta), Reports.
- VEHICLE: Dashboard, Global Customers, Vehicle Origination, Repossession Yard, Receipts & Ledger, Daybook (Chitta), Reports.
- CAPITAL: Deposits & Investors.
- ADMINISTRATION: Financials (P&L), Settings.

Routing:

- `src/App.tsx` uses `BrowserRouter` with `basename` from `import.meta.env.BASE_URL`.
- All routes wrapped in `Layout` and render a `PlaceholderPage` for now.
- `/` redirects to `/dashboard`.

Local persistence + capture (added in the Capture & Management upgrade):

- `src/lib/stores/persistentStore.ts` — generic `createPersistentStore<T>(key, initial)` returning `{ get, set, subscribe }` and a `usePersistentStore` hook backed by `useSyncExternalStore`. JSON-serialized to `localStorage`, so any base64 image dataURL is preserved across full page reloads.
- `src/lib/stores/customersStore.ts` — `Customer` type with `photoDataUrl`, `dob`, `aadhar`, `pan`, address fields, KYC status, etc. Exposes `addCustomer / updateCustomer / deleteCustomer / useCustomers`. Auto-incrementing `KTG-` IDs (max existing + module counter, so refresh + re-add never collides). Storage key `kittangi:customers:v1`.
- `src/lib/stores/pledgedItemsStore.ts` — `PledgedItem` type with `photos: string[]`, status (`VAULTED | RELEASED | AUCTION`), gross/net weight, vault location, `originatedAt`. Exposes `addPledgedItem / updatePledgedItem / usePledgedItems`. Storage key `kittangi:pledged-items:v1`.
- `src/lib/stores/vaultConfigStore.ts` — `Safe[]` config (id, name, location, lockerCount, lockerPrefix). Exposes `useVaultConfig / addSafe / updateSafe / removeSafe`. Storage key `kittangi:vault-config:v1`. Drives both `VaultManagement.tsx` (visualizer) and the Settings → Vault Configuration tab.
- `src/lib/stores/branchProfileStore.ts` — branch identity (name, code, GSTIN, address, phone) used on every printed receipt and customer statement. Storage key `kittangi:branch-profile:v1`.
- `src/lib/stores/daybookStore.ts` — persisted Chitta entries (`DaybookEntry` with side, category, account [string id, no longer a fixed enum], amount, refId, customerName, paymentMode?, outstandingAfter?, notes?). Source of truth for the Receipts & Ledger module's "Today's Receipts" table and Customer 360 lifetime totals. Mixed payments are split into two entries (Interest Income + Principal Recovery) so per-category reports stay accurate. Categories now include "Loan Disbursement" (DEBIT) and "Expense" (DEBIT). `addDaybookEntry` throws `DayLockedError` when posting to a locked date. `removeDaybookEntry(id)` and `removeDaybookEntriesByRefId(refId)` are admin reversal helpers — they delete entries so derived account balances and reports auto-reconcile. Storage key `kittangi:daybook:v1`. Backward-compatible: legacy seed entries with `account: "CASH" | "HDFC" | "SBI"` still load (those literals remain the seed account ids).
- `src/lib/stores/accountsStore.ts` — unified Accounts ledger backbone. `Account = { id, name, type: "CASH"|"BANK", subtitle?, openingBalance, openedAtIso }`. Seeds: `CASH` ("Cash in Hand"), `HDFC` ("HDFC Bank"), `SBI` ("SBI Bank"). API: `useAccounts / getAccount / addAccount / updateAccount / deleteAccount / useAccountBalance / useAllAccountBalances / computeAccountBalance`. Balance derivation: `openingBalance + Σ(CREDIT entries) − Σ(DEBIT entries)` over the daybook — never stored, always recomputed, so any reversal automatically restores the correct balance. Storage key `kittangi:accounts:v1`.
- `src/lib/stores/loansStore.ts` — single source of truth for all loans across verticals. `Loan = { id, product: "PAWN"|"VEHICLE", customer, customerCode, principal, ratePctPerAnnum, startedAtIso, maturityIso?, status: "ACTIVE"|"CLOSED"|"AUCTION"|"DEFAULT", disbursedFromAccountId?, pledgedItemId?, vehicleDetails?, accruedInterest? }`. API: `useLoans / getLoan / addLoan / updateLoan`. Seeds: PWN-204512, PWN-204519, PWN-204527, PWN-204540, VEH-30021. Storage key `kittangi:loans:v1`.
- `src/lib/stores/userRoleStore.ts` — current user role. `useUserRole`, `setUserRole("ADMIN" | "CASHIER")`, `useIsAdmin`, `isAdmin`. Default ADMIN. Drives admin-only UI gating (delete receipt, close loan, mark for auction). Storage key `kittangi:user-role:v1`.
- `src/lib/stores/dayLocksStore.ts` — persisted per-date "Day Lock" snapshots (`DayLock` with `dateIso`, `lockedAtIso`, `totalCashIn`, `totalCashOut`, `netChange`, `entryCount`). API: `useDayLocks / getDayLock / lockDay / unlockDay / isDateLocked`. Storage key `kittangi:day-locks:v1`. The Daybook page exposes a primary "Lock Day & Generate Report" button that opens a confirm dialog with a copyable closure report; once locked, a banner replaces the button with "Unlock Day" (gated by an AlertDialog). The lock is enforced in two layers: (a) the write path — `addDaybookEntry` rejects new entries for locked dates with `DayLockedError`; (b) consumer pre-checks — both `ReceiptsLedger` (receipt submission) and `Deposits.handleRecordPayout` call `isDateLocked` BEFORE any persistence so multi-write flows cannot half-commit. In `Deposits`, the Daybook entry is posted first and the investor payout is recorded only on success, ensuring the ledger and investor history never diverge.
- `src/lib/stores/investorsStore.ts` — `Investor` records (principal, monthly rate, status, payouts[]) with `recordPayout`, `monthlyInterest` helper, `useInvestors`. Storage key `kittangi:investors:v1`.
- `src/components/shared/PhotoCapture.tsx` — single-photo capture: file upload + `getUserMedia` (front camera) → JPEG dataURL via canvas. Stops media tracks on unmount/cancel.
- `src/components/shared/ItemImageUploader.tsx` — multi-photo dropzone + camera (rear camera by default), max 6 photos / 5 MB each, with thumb tray and per-photo delete.
- Wiring: `Customers.tsx` adds avatar + Edit/Delete columns and a mode-aware drawer (Add/Edit) with `PhotoCapture`. Rows are clickable (open `CustomerLedgerSheet` Customer 360); Edit/Delete buttons stopPropagation. `PawnOrigination.tsx` has an "Item Photographs" card and on submit calls `addPledgedItem({..., photos})` so the new pledge appears immediately in `PledgedItems.tsx`, whose `ManageItemDialog` exposes status/weight editing and a photo carousel + thumbnails.

Print pipeline:

- `src/index.css` defines an `@media print` block that scopes visibility by `body[data-print-target="thermal" | "statement"]`, so multiple `.print-area` subtrees can co-exist on the page (e.g. a thermal receipt dialog while a Customer 360 statement is mounted) and only the active target prints.
- `ThermalReceipt.tsx` renders a 80mm receipt with `.print-area--thermal`; `CustomerLedgerSheet.tsx` renders a hidden A4 statement with `.print-area--statement`. Both wrap `window.print()` to set/restore the body attribute.
- The Settings page (`Settings.tsx`) has 5 tabs: Branch Profile, User Management, Rates & Fees, Accounts, Vault Configuration. The Vault Configuration tab uses `SafeDrawer` (Add/Edit) and an AlertDialog for delete, all wired to `vaultConfigStore`. The Accounts tab uses `AccountsTab` + `AccountDrawer` (Add/Edit/Delete with opening balance) and shows derived current balances via `useAllAccountBalances`. The User Management tab now also has an "Admin Mode" Switch tied to `setUserRole`/`useUserRole`.

Loan Management & Lifecycle (Centralized Financial Engine):

- `src/components/modules/LoanManagement.tsx` (`/loans`) — unified list view of all loans across verticals with filters (All / PAWN / VEHICLE / status). Each row links to `/loans/:id`. Available in both PAWN_NAV and VEHICLE_NAV.
- `src/components/modules/LoanLifecycle.tsx` (`/loans/:id`) — detail page with printable Pawn Ticket / Vehicle Agreement, item or vehicle details, linked daybook entries (filtered by loanId / refId), and admin-only "Close Loan" / "Mark for Auction" actions (each gated by `useIsAdmin` AND `isDateLocked` precheck, then a confirm `AlertDialog`). Closing a loan also flips the linked pledged item to RELEASED; marking for auction flips it to AUCTION.
- `src/components/modules/PawnOrigination.tsx` — now requires a Source Account selector + Maturity Date and an interest rate. On submit (after `isDateLocked` precheck): creates Loan in `loansStore`, creates PledgedItem with `loanId`, posts a single DEBIT "Loan Disbursement" daybook entry to the chosen account with `refId = loan.id`. The disbursement is therefore tied to a real account and reversible.
- `src/components/modules/ReceiptsLedger.tsx` — Active loan picker is now driven by `useLoans()` filtered to status="ACTIVE". Recording a payment requires selecting a credit account. Today's Receipts table groups by `refId` so split receipts (Interest + Principal) show as one row, with a "View" action that rebuilds the full `ThermalReceiptData` (reconstructing interest/principal split for Full Settlement using `loan.accruedInterest`) and re-opens the printable receipt dialog. An admin-only "Delete" column (gated by `useIsAdmin`) opens an AlertDialog → calls `removeDaybookEntriesByRefId(refId)` to fully reverse the receipt; the debited account balance auto-recomputes.
- `src/components/modules/Daybook.tsx` — Account chip resolves a daybook entry's `account` id through `accountsStore` (fallback to raw id) so chips read "Cash in Hand" / "HDFC Bank" instead of raw IDs.
- `src/components/modules/Deposits.tsx` — Investor payout dialog now requires picking a source account from `useAccounts()` and posts the DEBIT entry to that account (replaces the prior hard-coded CASH posting).

Reporting / Financials:

- `src/components/modules/Financials.tsx` (`/financials`, under ADMIN_NAV) — annual P&L statement and live Business Health Snapshot. FY dropdown follows the Indian Apr–Mar financial year and is built from the union of dated artefacts (daybook, investor deposits, payouts) plus the current FY. P&L = `Interest Earned (Pawn from "Interest Income" + Vehicle from "EMI Received") − Interest Paid (sum of investor payouts in FY) − Operating Expenses (Branch Expense + Salary + Utilities + Other Expense)`. Balance sheet snapshot = `Total Assets (outstanding loan-book principal: disbursements minus closed-loan disbursements minus principal recoveries against still-active disbursed loans) − Total Liabilities (sum of ACTIVE investor principals) → Net Worth/Deficit`. Recoveries with malformed/orphan refIds are explicitly skipped to avoid understating assets.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
