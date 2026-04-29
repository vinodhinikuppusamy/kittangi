import {
  BookOpen,
  LayoutDashboard,
  Users,
  Landmark,
  Vault,
  ReceiptText,
  Car,
  Wrench,
  Gem,
  HandCoins,
  PieChart,
  LineChart,
  ListChecks,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type Vertical = "PAWN" | "VEHICLE";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * When true the link is hidden from STAFF users in the sidebar and the
   * underlying route is gated behind `<RequireAuth requireAdmin />`. Used to
   * keep cashiers out of Financials, Deposits, and the Settings hub.
   */
  adminOnly?: boolean;
};

export const PAWN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Global Customers", icon: Users },
  { to: "/pawn-origination", label: "Pawn Origination", icon: Landmark },
  { to: "/loans", label: "Loan Management", icon: ListChecks },
  { to: "/pledged-items", label: "Pledged Items", icon: Gem },
  { to: "/vault-management", label: "Vault Management", icon: Vault },
  { to: "/receipts-ledger", label: "Receipts & Ledger", icon: ReceiptText },
  { to: "/daybook", label: "Daybook (Chitta)", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: PieChart },
];

export const VEHICLE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Global Customers", icon: Users },
  { to: "/vehicle-origination", label: "Vehicle Origination", icon: Car },
  { to: "/loans", label: "Loan Management", icon: ListChecks },
  { to: "/repossession-yard", label: "Repossession Yard", icon: Wrench },
  { to: "/receipts-ledger", label: "Receipts & Ledger", icon: ReceiptText },
  { to: "/daybook", label: "Daybook (Chitta)", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: PieChart },
];

export const CAPITAL_NAV: NavItem[] = [
  { to: "/deposits", label: "Deposits & Investors", icon: HandCoins, adminOnly: true },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/financials", label: "Financials (P&L)", icon: LineChart, adminOnly: true },
  { to: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
];

export function getNavForVertical(vertical: Vertical): NavItem[] {
  return vertical === "PAWN" ? PAWN_NAV : VEHICLE_NAV;
}
