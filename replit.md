# Kittangi OS - Monorepo Workspace

## Overview
Kittangi OS is a pnpm workspace monorepo designed as a multi-vertical financial management system primarily focusing on Pawn Broking and Vehicle Finance. Its core purpose is to provide a comprehensive solution for managing these financial services, aiming to streamline operations, enhance financial tracking, and offer robust reporting capabilities. The project seeks to provide a unified platform for loan origination, customer management, financial accounting, and regulatory compliance within these specialized financial sectors.

## User Preferences
I prefer clear and concise communication. When making changes, prioritize iterative development with small, reviewable commits. Ask for confirmation before implementing major architectural changes or introducing new external dependencies. I prefer detailed explanations for complex logic or significant feature implementations.

## System Architecture

### Monorepo Structure
The project is organized as a pnpm workspace monorepo containing a React + Vite frontend application (`artifacts/kittangi-os`), an Express API server (`artifacts/api-server`), and a UI design sandbox (`artifacts/mockup-sandbox`).

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