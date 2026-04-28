# Kittangi OS - Monorepo Workspace

## Overview
Kittangi OS is a pnpm workspace monorepo designed as a multi-vertical financial management system. It primarily focuses on Pawn Broking and Vehicle Finance, aiming to provide a comprehensive solution for managing these financial services. The project's vision is to streamline operations, enhance financial tracking, and offer robust reporting capabilities for businesses in these sectors.

## User Preferences
I prefer clear and concise communication. When making changes, prioritize iterative development with small, reviewable commits. Ask for confirmation before implementing major architectural changes or introducing new external dependencies. I prefer detailed explanations for complex logic or significant feature implementations.

## System Architecture

### Monorepo Structure
The project is organized as a pnpm workspace monorepo. It includes the following key artifacts:
- `artifacts/kittangi-os`: The main React + Vite frontend application.
- `artifacts/api-server`: A shared Express API for backend services.
- `artifacts/mockup-sandbox`: A design sandbox for UI component previews.

### Frontend (Kittangi OS Frontend)
- **Technology Stack**: React 18, Vite, TypeScript 5.9, Tailwind CSS v4, shadcn/ui.
- **Styling**: Uses a consistent brand palette with CSS variables for main background (`--bg-main: #E9F4FB`), sidebar (`--sidebar-bg: #FFFFFF`), primary actions (`--brand-primary: #4A6FA5`), accents (`--brand-accent: #89CFF0`), hover states (`--brand-light: #BFDDF5`), and text colors.
- **Layout**: Features a fixed 64px header and a 256px sidebar with an App Switcher. The `activeVertical` state dynamically controls sidebar content.
- **Navigation**: Supports two main verticals: PAWN (Dashboard, Origination, Vault, Ledger, Reports) and VEHICLE (Dashboard, Origination, Repossession, Ledger, Reports), along with CAPITAL (Deposits) and ADMINISTRATION (Financials, Settings).
- **Routing**: Implemented with `react-router-dom v6`, using `BrowserRouter` and `basename` from environment variables. All routes are wrapped in the main `Layout`.
- **Local Persistence**: Utilizes `localStorage` for client-side data persistence through custom stores for customers, pledged items, vault configuration, branch profiles, daybook entries, accounts, loans, user roles, day locks, and investors. Data is JSON-serialized.
- **Image Capture**: `PhotoCapture.tsx` and `ItemImageUploader.tsx` components handle single and multi-photo capture using file uploads and `getUserMedia` for camera access, storing images as base64 dataURLs.
- **Print Pipeline**: Features a flexible print system using `@media print` blocks and `body[data-print-target]` attributes to selectively print thermal receipts (`ThermalReceipt.tsx`) or A4 statements. The CSS contract recognises only two values: `"thermal"` → `.print-area--thermal`, and `"statement"` → `.print-area--statement`. Any new printable surface MUST adopt one of these two classes; otherwise the global `body * { visibility: hidden }` rule will print a blank page.
- **Shared Loan Document**: `src/components/shared/DocumentViewer.tsx` is the single source of truth for both A4 Pawn Tickets and Vehicle Loan Agreements. It branches on `loan.product` and renders branch header, KYC block (with photo or initials avatar), financial-terms grid, item card / vehicle card, T&Cs, and signature lines. Tagged `print-area print-area--statement` and consumed by `LoanLifecycle.tsx`.
- **Loan Management & Lifecycle**: A centralized financial engine handles loan origination, status tracking, and repayment. Loan details are managed in `loansStore`, with integration into daybook entries and account balances.
- **Reporting / Financials**: The `Financials` module provides an annual P&L statement and a live Business Health Snapshot, calculating assets, liabilities, and net worth based on loan book, investor capital, and operational expenses.
- **CSV / Excel Export**: `src/lib/csv.ts` provides `buildCsv` + `downloadCsv(filename, columns, rows)` — emits UTF-8 text with a `\uFEFF` byte-order mark so Microsoft Excel honours non-ASCII characters, escapes commas/quotes/newlines, and triggers a `Blob` download via a synthetic anchor. Both `Reports.tsx` (Loan Register / Interest Collections / Maturity & Defaults) and `VehicleReports.tsx` (Disbursal Log / Collections / NPA) wire their "Export to Excel" button to this helper, tab-aware and date-range filtered, with a final TOTAL row appended. Filenames follow `kittangi-<report>-<from>_to_<to>.csv`.
- **Daybook Manual Expense Entry**: `Daybook.tsx` exposes an admin-only "Add Expense" header button (hidden when the day is locked) that opens a dialog with category (Salary / Branch Expense / Utilities / Other Expense), source account, amount, and particulars. Submission posts a `DEBIT` entry via `addDaybookEntry` with `refId = EXP-<seq>`, which immediately mutates the bound account's balance through `accountsStore.useAccountBalance`.
- **Atomic Vehicle Disbursement**: `VehicleOrigination.tsx` performs a full origination in one click — `addLoan({ product: VEHICLE, vehicleDetails, disbursedFromAccountId })` followed by a DEBIT `addDaybookEntry` for the net disbursement against the chosen source account. Day-locking is rechecked inside the handler and any `DayLockedError` triggers `deleteLoan(loanId)` rollback so the books can never end up with an orphaned loan.
- **Vault Sync on Loan Close**: `LoanLifecycle.handleCloseLoan` now sets `vaultLoc: undefined` on the linked pledged item when flipping it to `RELEASED`, so the locker frees up across all surfaces (Pledged Items list, Vault Management). `handleMarkForAuction` deliberately retains `vaultLoc` because the item is still physically in the vault until claimed.
- **Strict Loan Closure (Final Settlement)**: `LoanLifecycle.tsx` ships a `FinalSettlementDialog` that posts a CREDIT receipt against the chosen account and only flips the loan to `CLOSED` (and releases the pledged item) when the projected balance is **exactly ₹0**. Overpayments are rejected (red banner + disabled submit) and partial payments stay `ACTIVE`. The atomic close + vault release is encapsulated in `loansStore.closeLoanWithSettlement(loanId)`.
- **Document Loan (Unsecured)**: `LoanManagement` ships a header "Document Loan" button that opens `DocumentLoanDialog.tsx`. It creates a `product: "DOCUMENT"` loan in `loansStore` and posts the cash-out DEBIT to the Daybook **first** so day-lock failures cannot leave an orphan loan. On success it navigates to `/loans/<DOC-id>`. The Loan Management filter and product badges include `DOCUMENT`.
- **Vault Packet QR (Pawn Origination)**: `PawnOrigination.tsx` replaces the success toast with a success Dialog that renders a `QRCodeSVG` (qrcode.react) encoding `{type:"kittangi.vault.packet", loanId, customer, customerCode, safe, locker, item}`. Buttons offer "Originate Another" or "Open Loan". Origination is reordered for atomicity: Daybook DEBIT → addPledgedItem → addLoan, so a `DayLockedError` aborts before any pledge/loan is committed.
- **Vehicle Legal Docs**: `VehicleOrigination.tsx` exposes a "Legal Documents" Card with four mandatory file inputs (RC / Insurance / Agreement / Permit), each capped at 4 MB and stored as base64 dataURLs on `loan.legalDocs`. `RepossessionYard.tsx` looks up the loan via `useLoans` and shows a "View Legal Docs" button with an `N/4` badge that opens a Dialog of download links.
- **Trial Balance + Yearly Balance Sheet**: `Financials.tsx` adds two cards: a Trial Balance (debits-vs-credits tie-out badge sourced from `daybookStore`) and a Yearly Balance Sheet (Assets = Cash + Bank + Active Loans + Accrued Interest; Liabilities = Investor Deposits; Equity = Opening Capital + plug Retained Earnings). Both render with `BSColumn` helpers and tabular-nums money columns.
- **Print Chitta**: `Daybook.tsx` "Print Chitta" sets `document.body.dataset.printTarget = "chitta"` (try/finally restored), wraps the printable region in `print-area print-area--chitta`, and adds a print-only `chitta-print-banner` (date + opening/closing balance) plus a `chitta-print-signature` block (Branch Manager / Authorised Reviewer). `index.css` extends the print contract with `body[data-print-target="chitta"]` selectors so the page prints clean A4 without leaking into the thermal/statement print flows.

### Backend (API Server)
- **Technology Stack**: Express 5.
- **Database (Planned/Partially Integrated)**: PostgreSQL with Drizzle ORM (though not yet fully utilized according to the document).
- **Validation**: Uses Zod for schema validation.
- **API Code Generation**: Orval is used to generate API hooks and Zod schemas from OpenAPI specifications.

### Core Features
- **Customer Management**: Comprehensive customer profiles with KYC details and photo capture.
- **Pawn & Vehicle Origination**: Workflows for creating new pawn and vehicle loans, linking to pledged items or vehicle details.
- **Vault Management**: Visualizer for vault configuration and management of pledged item locations.
- **Daybook & Ledger**: Detailed daybook for financial transactions, supporting various categories, accounts, and payment modes, with day locking mechanism.
- **Account Management**: Unified accounts ledger with recomputed balances, supporting cash and bank accounts.
- **Investor Management**: Tracking investor deposits, payouts, and monthly interest calculations.
- **User Roles**: Basic role-based access control (Admin/Cashier) affecting UI visibility and critical actions.

## External Dependencies
- **Monorepo Tool**: pnpm workspaces
- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript 5.9
- **Styling Framework**: Tailwind CSS v4
- **UI Component Library**: shadcn/ui (primitives)
- **Routing Library**: react-router-dom v6
- **Icon Library**: lucide-react
- **Backend Framework**: Express 5
- **Database**: PostgreSQL (planned/partially integrated)
- **ORM**: Drizzle ORM (planned/partially integrated)
- **Validation Library**: Zod (`zod/v4`), `drizzle-zod`
- **API Code Generator**: Orval
- **Bundler**: esbuild (for CJS bundle)