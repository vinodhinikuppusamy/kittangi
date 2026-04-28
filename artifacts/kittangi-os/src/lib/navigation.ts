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
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type Vertical = "PAWN" | "VEHICLE";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const PAWN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Global Customers", icon: Users },
  { to: "/pawn-origination", label: "Pawn Origination", icon: Landmark },
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
  { to: "/repossession-yard", label: "Repossession Yard", icon: Wrench },
  { to: "/receipts-ledger", label: "Receipts & Ledger", icon: ReceiptText },
  { to: "/daybook", label: "Daybook (Chitta)", icon: BookOpen },
  { to: "/reports", label: "Reports", icon: PieChart },
];

export const CAPITAL_NAV: NavItem[] = [
  { to: "/deposits", label: "Deposits & Investors", icon: HandCoins },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/financials", label: "Financials (P&L)", icon: LineChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function getNavForVertical(vertical: Vertical): NavItem[] {
  return vertical === "PAWN" ? PAWN_NAV : VEHICLE_NAV;
}
