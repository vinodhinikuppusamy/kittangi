import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";
import { getUser } from "@/lib/stores/usersStore";

const SESSION_KEY = "kittangi:session:v1";

/**
 * Activity Log — a small, capped, persistent ring buffer of recent user
 * actions across the app. Used by the Dashboard "Recent Activity" widget
 * and (eventually) the Settings → Audit tab.
 *
 * Conventions:
 *   - `actor` is the username (or "system" if no auth context is available
 *     at the call site).
 *   - `kind` is a short verb-noun bucket so the UI can render an icon and
 *     filter without relying on freeform `summary` text.
 *   - `summary` is a single human-readable line (no PII the user wouldn't
 *     already see in the UI).
 *   - `link` is an optional in-app path (e.g. `/loans/PWN-204512`) so the
 *     widget can offer a "View" deep-link.
 *
 * The store is capped at MAX_ENTRIES so localStorage doesn't grow without
 * bound; the Dashboard widget only ever shows the latest 5.
 */

export type ActivityKind =
  | "AUTH"
  | "LOAN"
  | "CUSTOMER"
  | "DAYBOOK"
  | "VAULT"
  | "REPO"
  | "SETTINGS";

export type ActivityEntry = {
  id: string;
  /** ISO timestamp (e.g. 2026-04-29T11:42:13.882Z) */
  atIso: string;
  actor: string;
  kind: ActivityKind;
  summary: string;
  link?: string;
};

const STORAGE_KEY = "kittangi:activity-log:v1";
const MAX_ENTRIES = 200;

const activityLogStore = createPersistentStore<ActivityEntry[]>(
  STORAGE_KEY,
  [],
);

let nextSeq = 0;
function nextId(existing: ActivityEntry[]): string {
  const max = existing.reduce((m, e) => {
    const match = /^ACT-(\d+)$/.exec(e.id);
    if (!match) return m;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  if (nextSeq <= max) nextSeq = max + 1;
  else nextSeq += 1;
  return `ACT-${nextSeq}`;
}

export function useActivityLog(): ActivityEntry[] {
  return usePersistentStore(activityLogStore);
}

/**
 * Resolve the currently signed-in actor without requiring the React tree.
 * Reads the same SESSION_KEY that AuthContext writes, then looks up the user
 * in the usersStore. Falls back to "system" so log calls never throw.
 */
export function getCurrentActor(): string {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return "system";
    const id = JSON.parse(raw) as string;
    if (!id) return "system";
    const user = getUser(id);
    return user?.username ?? "system";
  } catch {
    return "system";
  }
}

export function logActivity(args: {
  actor: string;
  kind: ActivityKind;
  summary: string;
  link?: string;
}): ActivityEntry {
  const created: ActivityEntry = {
    id: nextId(activityLogStore.get()),
    atIso: new Date().toISOString(),
    actor: args.actor || "system",
    kind: args.kind,
    summary: args.summary,
    link: args.link,
  };
  activityLogStore.set((prev) => {
    const next = [created, ...prev];
    return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
  });
  return created;
}

export function clearActivityLog(): void {
  activityLogStore.set([]);
}
