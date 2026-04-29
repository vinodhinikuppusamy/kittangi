import { wipeDaybook } from "@/lib/stores/daybookStore";
import { resetDayLocks } from "@/lib/stores/dayLocksStore";
import { wipeLoans } from "@/lib/stores/loansStore";
import { wipePledgedItems } from "@/lib/stores/pledgedItemsStore";

/**
 * Admin-only "factory reset" of operational data.
 *
 * Wipes (NOT seed-restores) the operational stores so subscribers re-render
 * in the same tick. Configuration data (users, settings, branch profile,
 * vault config, customers, investors, accounts) is intentionally preserved.
 *
 * `resetDayLocks` is correct here — it sets the dayLocks array to `[]`,
 * which is the desired wiped state.
 */
export function performSystemReset(): { wiped: string[]; preserved: string[] } {
  wipeDaybook();
  wipeLoans();
  wipePledgedItems();
  resetDayLocks();

  return {
    wiped: ["Daybook", "Loans", "Pledged Items", "Day Locks"],
    preserved: [
      "Users",
      "Settings",
      "Branch Profile",
      "Vault Configuration",
      "Customers",
      "Investors",
      "Accounts",
    ],
  };
}
