/**
 * DataSyncProvider — hydrates all in-memory stores from the API whenever the
 * user signs in. Writes are forwarded to the API from each store mutation.
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { setApiToken, fetchAll, fetchOne } from "@/lib/stores/apiSync";
import { hydratePersistentStore } from "@/lib/stores/persistentStore";
import { getSettings } from "@/lib/stores/settingsStore";

// Store keys used by the in-memory persistent stores.
const STORE_KEYS = {
  customers: "kittangi:customers:v1",
  loans: "kittangi:loans:v1",
  pledgedItems: "kittangi:pledgedItems:v1",
  daybook: "kittangi:daybook:v1",
  accounts: "kittangi:accounts:v1",
  investors: "kittangi:investors:v1",
  dayLocks: "kittangi:dayLocks:v1",
  activityLog: "kittangi:activityLog:v1",
  branchProfile: "kittangi:branchProfile:v1",
  users: "kittangi:users:v1",
  settings: "kittangi:settings:v1",
};

function hydrateKey(key: string, data: unknown): void {
  if (!data) return;
  hydratePersistentStore(key, data);
}

async function syncAllFromApi(token: string | null): Promise<void> {
  setApiToken(token);

  const [
    customers,
    loans,
    pledgedItems,
    daybook,
    accounts,
    investors,
    dayLocks,
    activityLog,
    branchProfile,
    users,
    settings,
  ] = await Promise.allSettled([
    fetchAll("/customers"),
    fetchAll("/loans"),
    fetchAll("/pledged-items"),
    fetchAll("/daybook"),
    fetchAll("/accounts"),
    fetchAll("/investors"),
    fetchAll("/day-locks"),
    fetchAll("/activity-log?limit=500"),
    fetchOne("/branch-profile"),
    fetchAll("/users"),
    fetchOne("/settings"),
  ]);

  if (customers.status === "fulfilled" && customers.value) {
    hydrateKey(STORE_KEYS.customers, customers.value);
  }
  if (loans.status === "fulfilled" && loans.value) {
    hydrateKey(STORE_KEYS.loans, loans.value);
  }
  if (pledgedItems.status === "fulfilled" && pledgedItems.value) {
    hydrateKey(STORE_KEYS.pledgedItems, pledgedItems.value);
  }
  if (daybook.status === "fulfilled" && daybook.value) {
    hydrateKey(STORE_KEYS.daybook, daybook.value);
  }
  if (accounts.status === "fulfilled" && accounts.value) {
    hydrateKey(STORE_KEYS.accounts, accounts.value);
  }
  if (investors.status === "fulfilled" && investors.value) {
    hydrateKey(STORE_KEYS.investors, investors.value);
  }
  if (dayLocks.status === "fulfilled" && dayLocks.value) {
    hydrateKey(STORE_KEYS.dayLocks, dayLocks.value);
  }
  if (activityLog.status === "fulfilled" && activityLog.value) {
    hydrateKey(STORE_KEYS.activityLog, activityLog.value);
  }
  if (branchProfile.status === "fulfilled" && branchProfile.value) {
    hydrateKey(STORE_KEYS.branchProfile, branchProfile.value);
  }
  if (users.status === "fulfilled" && users.value) {
    hydrateKey(STORE_KEYS.users, users.value);
  }
  if (settings.status === "fulfilled" && settings.value) {
    // Merge API-fetched settings on top of the in-memory defaults so that any
    // key the backend doesn't know about yet falls back to the frontend default.
    const merged = { ...getSettings(), ...(settings.value as Record<string, unknown>) };
    hydrateKey(STORE_KEYS.settings, merged);
  }
}

export function DataSyncProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      prevUserRef.current = null;
      setApiToken(null);
      return;
    }
    if (prevUserRef.current !== user.id) {
      prevUserRef.current = user.id;
      // Hydrate stores from API on login/switch.
      void syncAllFromApi(token);
    } else {
      // Keep token fresh for subsequent API mutations.
      setApiToken(token);
    }
  }, [user, token]);

  return <>{children}</>;
}
