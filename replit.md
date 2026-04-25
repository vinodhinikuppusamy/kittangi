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

- PAWN: Dashboard, Global Customers, Pawn Origination, Vault Management, Receipts & Ledger.
- VEHICLE: Dashboard, Global Customers, Auto Loans, Repossession Yard, Receipts & Ledger.

Routing:

- `src/App.tsx` uses `BrowserRouter` with `basename` from `import.meta.env.BASE_URL`.
- All routes wrapped in `Layout` and render a `PlaceholderPage` for now.
- `/` redirects to `/dashboard`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
