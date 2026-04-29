# Kittangi OS - Monorepo Workspace

## Overview
Kittangi OS is a pnpm workspace monorepo designed as a multi-vertical financial management system primarily focusing on Pawn Broking and Vehicle Finance. Its core purpose is to provide a comprehensive solution for managing these financial services, aiming to streamline operations, enhance financial tracking, and offer robust reporting capabilities. The project seeks to provide a unified platform for loan origination, customer management, financial accounting, and regulatory compliance within these specialized financial sectors.

## User Preferences
I prefer clear and concise communication. When making changes, prioritize iterative development with small, reviewable commits. Ask for confirmation before implementing major architectural changes or introducing new external dependencies. I prefer detailed explanations for complex logic or significant feature implementations.

## System Architecture

### Monorepo Structure
The project is organized as a pnpm workspace monorepo containing a React + Vite frontend application (`artifacts/kittangi-os`), an Express API server (`artifacts/api-server`), and a UI design sandbox (`artifacts/mockup-sandbox`).

### Interest Engine & Processing Fee (Apr 2026)
A shared interest engine (`src/lib/interest.ts`) is now the single source of
truth for accrued interest. Pricing rule: the first 30 days always charge a
full month of interest (the "minimum month" floor); days beyond 30 accrue
per-day at the daily-equivalent rate (`monthly / 30`). For ₹1,00,000 @ 30%
p.a. that is ₹2,500 at day 30 and ₹3,750 at day 45. The engine drives the
Outstanding Dues panel (Receipts Ledger), the Final Settlement dialog (Loan
Lifecycle), the new "Accrued Interest" column in Loan Management, and the
Balance Sheet's accrued-interest asset line (Financials) — the seeded
`loan.accruedInterest` field is now legacy. A status-aware wrapper
(`accruedInterestForLoan`) freezes accrual at `loan.closedAtIso` once a
loan transitions out of ACTIVE, and returns ₹0 for legacy closed loans
that predate the closure-timestamp field. `closeLoanWithSettlement` /
`markLoanForAuction` stamp `closedAtIso` automatically on transition. Origination forms (Pawn,
Vehicle, and the rebuilt "New Loan" dialog) no longer collect a manual
processing fee; all three auto-derive it from `Settings → Rates & Fees →
Processing Fee per ₹1,000` (default ₹15/₹1k ⇒ ₹1,500 on a ₹1L loan), post
the NET amount to the Daybook, and store the GROSS as `loan.principal`. The
split-interest helper (`splitInterest`) continues to allocate Legal vs
Company portions; updated defaults are pawn rate 2.5%/m (30% p.a.) and
legal component 18% p.a. so the standard pawn loan splits as 1.5%/m Legal
+ 1.0%/m Company.

### "New Loan" Dialog (Apr 2026)
The Loan Management catch-all CTA was renamed from "Document Loan" to
"New Loan" and rebuilt into a general-purpose origination flow
(`DocumentLoanDialog.tsx`). It now mirrors the Pawn/Vehicle pattern: a
per-loan **Legal Interest** override (defaults to
`settings.globalLegalInterestRatePct`, with auto-computed Company
remainder), an **auto-derived slab processing fee** preview, and a
multi-file **Legal/Collateral document uploader** that persists each
attachment to `loan.legalDocs` as a base64 data URL of type `AGREEMENT`.
Uploads are bounded (≤ 4 MB per file, ≤ 12 MB total, ≤ 8 files) so the
loan record stays well under the localStorage quota.

### Trial Balance — Balance-Sheet Style (Apr 2026)
The Trial Balance card in `Financials.tsx` was rewritten from a
per-category sum-of-debits/sum-of-credits view (which never balanced
because the Daybook `side` is account-perspective, not strict
double-entry) into a proper accounting identity:
- **DR**: Outstanding Loan Principal (gross basis, sum of `loan.principal`
  for active loans minus matched Principal Recovery entries) + Cash &
  Bank Account Balances + Cumulative Operating Expenses (Branch Expense,
  Salary, Utilities, Interest Expense, Other Expense).
- **CR**: Active Investor Deposits + Interest Collected (split into Legal
  + Company portions, using per-entry `legalInterestPortion` /
  `companyInterestPortion` fields when present, otherwise the
  `globalLegalInterestRatePct ÷ 30 %` ratio fallback) + Processing Fees
  Earned (computed as Σ `loan.principal − daybook disbursement amount`)
  + Opening Capital (sum of account opening balances).
Any residual is surfaced as an "Out by ₹X" badge (green "Balanced" when
< ₹0.50). The accounting identity is verified to hold under all new
postings — the only persistent gap traces back to seed data (investor
deposits not mirrored to the Daybook, plus legacy Full Settlement entries
that predate the legal/company portion split fields).

### Frontend (Kittangi OS Frontend)
The frontend is built with React 18, Vite, TypeScript 5.9, Tailwind CSS v4, and shadcn/ui. It uses a consistent brand color palette defined with CSS variables. The layout includes a fixed header and a sidebar with an App Switcher for navigating between PAWN, VEHICLE, CAPITAL, and ADMINISTRATION verticals. Routing is handled by `react-router-dom v6`. Client-side data persistence uses `localStorage` for various stores like customers, pledged items, loans, and accounts. Key features include photo capture using `getUserMedia`, a flexible print pipeline for thermal receipts and A4 statements, and a shared `DocumentViewer` for loan agreements. The system includes a comprehensive loan management lifecycle, reporting capabilities with CSV/Excel export, daybook entries for expenses and internal transfers, atomic vehicle disbursement, and strict loan closure logic. It supports document loans, vault packet QR code generation for pawn origination, and storage of legal documents for vehicle loans. Financials include Trial Balance, Yearly Balance Sheet, and a "Print Chitta" feature for daybook summaries. Global settings allow for manual interest splitting, and a robust authentication system with role-based access control (RBAC) is implemented, supporting Admin and Staff roles. The system also features part release/renew functionality for pawn items and a system reset option for development.

### Backend (API Server)
The backend uses Express 5. It is designed for PostgreSQL with Drizzle ORM, though full integration is ongoing. Zod is used for schema validation, and Orval generates API hooks and Zod schemas from OpenAPI specifications.

### Core Features
- **Customer Management**: Detailed profiles with KYC and photo capture.
- **Loan Origination**: Workflows for Pawn and Vehicle loans, including pledged items and vehicle details.
- **Vault Management**: Visualizer for vault configuration and item tracking.
- **Daybook & Ledger**: Detailed financial transaction logging with day locking, supporting various categories and accounts.
- **Account Management**: Unified ledger for cash and bank accounts with recomputed balances.
- **Investor Management**: Tracking deposits, payouts, and interest.
- **User Roles**: Role-based access control (Admin/Staff) for UI and critical actions.
- **Activity Logging**: Tracks significant system events.
- **Dashboard**: Overhauled with key performance indicators and a 6-month stacked bar chart.
- **Advanced Reporting**: New Weekly Performance tab and enhanced Excel exports using SheetJS.
- **Print Functionality**: Dedicated print features for vault locker tags and daybook chittas.

## External Dependencies
- **Monorepo Tool**: pnpm workspaces
- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript 5.9
- **Styling Framework**: Tailwind CSS v4
- **UI Component Library**: shadcn/ui
- **Routing Library**: react-router-dom v6
- **Icon Library**: lucide-react
- **Backend Framework**: Express 5
- **Database (Planned/Partial)**: PostgreSQL
- **ORM (Planned/Partial)**: Drizzle ORM
- **Validation Library**: Zod
- **API Code Generator**: Orval
- **Bundler**: esbuild
- **QR Code Generation**: qrcode.react
- **Spreadsheet Export**: SheetJS