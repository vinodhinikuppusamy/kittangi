import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Lightweight session-style role gate. The demo defaults to ADMIN so all
 * destructive flows (Delete Receipt, Close Loan, Mark for Auction, Add
 * Expense) work out of the box; the Header role toggle and the
 * Settings → User Management → Admin Mode switch can flip it to STAFF to
 * exercise the restricted experience.
 *
 * NOTE: Earlier builds persisted the value "CASHIER" — we still coerce that to
 * "STAFF" for compatibility when legacy values are encountered.
 */

export type UserRole = "ADMIN" | "STAFF";

const STORAGE_KEY = "kittangi:user-role:v1";

const roleStore = createPersistentStore<UserRole>(STORAGE_KEY, "ADMIN");

// One-time migration: legacy "CASHIER" value → "STAFF".
const initial = roleStore.get() as string;
if (initial !== "ADMIN" && initial !== "STAFF") {
  roleStore.set("STAFF");
}

export function useUserRole(): UserRole {
  return usePersistentStore(roleStore);
}

export function setUserRole(next: UserRole): void {
  roleStore.set(next);
}

export function useIsAdmin(): boolean {
  return useUserRole() === "ADMIN";
}

export function isAdmin(): boolean {
  return roleStore.get() === "ADMIN";
}
