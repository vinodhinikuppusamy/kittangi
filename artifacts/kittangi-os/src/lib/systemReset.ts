import { wipeCustomers } from "@/lib/stores/customersStore";
import { wipeDaybook } from "@/lib/stores/daybookStore";
import { resetDayLocks } from "@/lib/stores/dayLocksStore";
import { wipeInvestors } from "@/lib/stores/investorsStore";
import { wipeLoans } from "@/lib/stores/loansStore";
import { wipePledgedItems } from "@/lib/stores/pledgedItemsStore";
import { clearActivityLog } from "@/lib/stores/activityLogStore";
import { pruneUsersToOne } from "@/lib/stores/usersStore";

/**
 * Admin-only "Wipe All Transactional Data" — the production launch reset.
 *
 * Deletes every store that captures live operational activity (loans,
 * receipts via daybook, customers, investor capital, pledged items,
 * activity log, day locks). Configuration stores stay intact:
 *   • Vault layout (safes / lockers)
 *   • Account definitions (cash drawers + bank accounts) and their
 *     configured opening balances
 *   • Branch profile (used on every printed receipt)
 *   • Global settings (rates, fees, legal interest split)
 *
 * The users list is pruned down to the admin who triggered the reset
 * (and forced back to ADMIN/ACTIVE), so the operator can sign back in
 * straight after the wipe and onboard the rest of the staff manually.
 *
 * Returns the keeperId that survived, or `null` when the requested
 * keeper id wasn't found — in that case the user list is left untouched
 * so the operator isn't locked out by a faulty caller.
 */
export function performSystemReset(
  keeperUserId: string,
): { wiped: string[]; preserved: string[]; keeperId: string | null } {
  // Order matters loosely: clear loan-bound stores first so any reactive
  // selectors that re-render mid-tick see consistent empty buckets.
  wipeLoans();
  wipePledgedItems();
  wipeDaybook();
  wipeCustomers();
  wipeInvestors();
  resetDayLocks();
  clearActivityLog();
  const kept = pruneUsersToOne(keeperUserId);

  return {
    wiped: [
      "Loans",
      "Pledged Items",
      "Daybook entries (Receipts)",
      "Customer records",
      "Investor capital & payouts",
      "Day locks",
      "Activity log",
      kept ? "All users except current admin" : "Users (skipped — keeper not found)",
    ],
    preserved: [
      "Vault configuration (safes & lockers)",
      "Account definitions (cash & bank, with opening balances)",
      "Branch profile",
      "Global settings (rates, fees, legal split)",
    ],
    keeperId: kept ? keeperUserId : null,
  };
}
