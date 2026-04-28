import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Lightweight session-style role gate. The demo defaults to admin so all
 * destructive flows (Delete Receipt, Close Loan, Mark for Auction) work
 * out of the box; in Settings → Branch Profile / Admin Mode the user can
 * toggle this off to exercise the cashier-only experience.
 */

export type UserRole = "ADMIN" | "CASHIER";

const STORAGE_KEY = "kittangi:user-role:v1";

const roleStore = createPersistentStore<UserRole>(STORAGE_KEY, "ADMIN");

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
