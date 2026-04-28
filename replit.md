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

Local persistence + capture (added in the Capture & Management upgrade):

- `src/lib/stores/persistentStore.ts` — generic `createPersistentStore<T>(key, initial)` returning `{ get, set, subscribe }` and a `usePersistentStore` hook backed by `useSyncExternalStore`. JSON-serialized to `localStorage`, so any base64 image dataURL is preserved across full page reloads.
- `src/lib/stores/customersStore.ts` — `Customer` type with `photoDataUrl`, `dob`, `aadhar`, `pan`, address fields, KYC status, etc. Exposes `addCustomer / updateCustomer / deleteCustomer / useCustomers`. Auto-incrementing `KTG-` IDs (max existing + module counter, so refresh + re-add never collides). Storage key `kittangi:customers:v1`.
- `src/lib/stores/pledgedItemsStore.ts` — `PledgedItem` type with `photos: string[]`, status (`VAULTED | RELEASED | AUCTION`), gross/net weight, vault location, `originatedAt`. Exposes `addPledgedItem / updatePledgedItem / usePledgedItems`. Storage key `kittangi:pledged-items:v1`.
- `src/lib/stores/vaultConfigStore.ts` — `Safe[]` config (id, name, location, lockerCount, lockerPrefix). Exposes `useVaultConfig / addSafe / updateSafe / removeSafe`. Storage key `kittangi:vault-config:v1`. Drives both `VaultManagement.tsx` (visualizer) and the Settings → Vault Configuration tab.
- `src/lib/stores/branchProfileStore.ts` — branch identity (name, code, GSTIN, address, phone) used on every printed receipt and customer statement. Storage key `kittangi:branch-profile:v1`.
- `src/lib/stores/daybookStore.ts` — persisted Chitta entries (`DaybookEntry` with side, category, account, amount, refId, customerName). Source of truth for the Receipts & Ledger module's "Today's Receipts" table and Customer 360 lifetime totals. Mixed payments are split into two entries (Interest Income + Principal Recovery) so per-category reports stay accurate. Storage key `kittangi:daybook:v1`.
- `src/components/shared/PhotoCapture.tsx` — single-photo capture: file upload + `getUserMedia` (front camera) → JPEG dataURL via canvas. Stops media tracks on unmount/cancel.
- `src/components/shared/ItemImageUploader.tsx` — multi-photo dropzone + camera (rear camera by default), max 6 photos / 5 MB each, with thumb tray and per-photo delete.
- Wiring: `Customers.tsx` adds avatar + Edit/Delete columns and a mode-aware drawer (Add/Edit) with `PhotoCapture`. Rows are clickable (open `CustomerLedgerSheet` Customer 360); Edit/Delete buttons stopPropagation. `PawnOrigination.tsx` has an "Item Photographs" card and on submit calls `addPledgedItem({..., photos})` so the new pledge appears immediately in `PledgedItems.tsx`, whose `ManageItemDialog` exposes status/weight editing and a photo carousel + thumbnails.

Print pipeline:

- `src/index.css` defines an `@media print` block that scopes visibility by `body[data-print-target="thermal" | "statement"]`, so multiple `.print-area` subtrees can co-exist on the page (e.g. a thermal receipt dialog while a Customer 360 statement is mounted) and only the active target prints.
- `ThermalReceipt.tsx` renders a 80mm receipt with `.print-area--thermal`; `CustomerLedgerSheet.tsx` renders a hidden A4 statement with `.print-area--statement`. Both wrap `window.print()` to set/restore the body attribute.
- The Settings page (`Settings.tsx`) has 4 tabs: Branch Profile, User Management, Rates & Fees, Vault Configuration. The Vault Configuration tab uses `SafeDrawer` (Add/Edit) and an AlertDialog for delete, all wired to `vaultConfigStore`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
