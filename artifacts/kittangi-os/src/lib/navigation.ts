import {
  BookOpen,
  LayoutDashboard,
  Users,
  Landmark,
  Vault,
  ReceiptText,
  Car,
  Wrench,
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
  { to: "/vault-management", label: "Vault Management", icon: Vault },
  { to: "/receipts-ledger", label: "Receipts & Ledger", icon: ReceiptText },
  { to: "/daybook", label: "Daybook (Chitta)", icon: BookOpen },
];

export const VEHICLE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Global Customers", icon: Users },
  { to: "/auto-loans", label: "Auto Loans", icon: Car },
  { to: "/repossession-yard", label: "Repossession Yard", icon: Wrench },
  { to: "/receipts-ledger", label: "Receipts & Ledger", icon: ReceiptText },
  { to: "/daybook", label: "Daybook (Chitta)", icon: BookOpen },
];

export function getNavForVertical(vertical: Vertical): NavItem[] {
  return vertical === "PAWN" ? PAWN_NAV : VEHICLE_NAV;
}
