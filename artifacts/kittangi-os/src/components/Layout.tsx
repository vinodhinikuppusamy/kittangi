import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Banknote, Bell, ChevronDown, FileText, LogOut, Menu, Search, UserCircle, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_NAV,
  CAPITAL_NAV,
  getNavForVertical,
  type NavItem,
  type Vertical,
} from "@/lib/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCustomers } from "@/lib/stores/customersStore";
import { useLoans } from "@/lib/stores/loansStore";
import { useDaybook } from "@/lib/stores/daybookStore";
import { Kbd } from "@/components/ui/kbd";

function AppSwitcher({
  value,
  onChange,
}: {
  value: Vertical;
  onChange: (next: Vertical) => void;
}) {
  return (
    <div className="px-4 pt-4 pb-3">
      <label
        htmlFor="vertical-switcher"
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        Active Vertical
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as Vertical)}>
        <SelectTrigger
          id="vertical-switcher"
          className="h-11 w-full border-2 text-sm font-semibold transition-colors"
          style={{
            border: "1px solid rgba(74, 111, 165, 0.18)",
            color: "var(--text-main)",
            // "--tw-ring-color": "rgba(74, 111, 165, 0.12)",
            boxShadow: "none"
          }}
        >
          <SelectValue placeholder="Select Vertical" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PAWN">Pawn Broking</SelectItem>
          <SelectItem value="VEHICLE">Vehicle Finance</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function SidebarLinkList({
  items,
  isAdmin,
  onItemClick,
}: {
  items: NavItem[];
  isAdmin: boolean;
  onItemClick?: () => void;
}) {
  // Admin-only links are filtered OUT for staff users so the sidebar matches
  // what's actually reachable. The route layer enforces the same gate so a
  // bookmarked URL doesn't slip through.
  const visible = useMemo(
    () => items.filter((item) => isAdmin || !item.adminOnly),
    [items, isAdmin],
  );
  if (visible.length === 0) return null;
  return (
    <ul className="space-y-1">
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onItemClick}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "is-active" : "hover-link",
                ].join(" ")
              }
              style={({ isActive }) =>
                isActive
                  ? {
                    backgroundColor: "var(--brand-primary)",
                    color: "#ffffff",
                  }
                  : { color: "var(--text-main)" }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    style={{
                      color: isActive ? "#ffffff" : "var(--text-muted)",
                    }}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({
  vertical,
  onChangeVertical,
  isAdmin,
  isOpen,
  onClose,
}: {
  vertical: Vertical;
  onChangeVertical: (v: Vertical) => void;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const items = getNavForVertical(vertical);

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:z-30 md:translate-x-0",
        ].join(" ")}
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "rgba(74, 111, 165, 0.12)",
        }}
      >
        {/* Brand */}
        <div
          className="relative flex items-center justify-center px-5"
          style={{ height: 96, borderBottom: "1px solid rgba(74,111,165,0.08)" }}
        >
          <img
            src="/kittangi.webp"
            alt="Kittangi Logo"
            className="h-16 w-44 object-contain"
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <AppSwitcher value={vertical} onChange={onChangeVertical} />

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarLinkList items={items} isAdmin={isAdmin} onItemClick={onClose} />

          {/* Capital section — admin-only, hidden entirely from staff. */}
          {isAdmin && (
            <>
              <div className="mt-6 px-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Capital
                </p>
              </div>
              <div className="mt-2">
                <SidebarLinkList
                  items={CAPITAL_NAV}
                  isAdmin={isAdmin}
                  onItemClick={onClose}
                />
              </div>
            </>
          )}

          {/* Administration section — admin-only. */}
          {isAdmin && (
            <>
              <div className="mt-6 px-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Administration
                </p>
              </div>
              <div className="mt-2">
                <SidebarLinkList
                  items={ADMIN_NAV}
                  isAdmin={isAdmin}
                  onItemClick={onClose}
                />
              </div>
            </>
          )}
        </nav>

        <div
          className="border-t px-4 py-3 text-[11px]"
          style={{
            borderColor: "rgba(74,111,165,0.10)",
            color: "var(--text-muted)",
          }}
        >
          v0.1.0 — Multi-Vertical
        </div>

        <style>{`
        .hover-link:hover {
          background-color: rgba(100, 116, 139, 0.08);
        }
      `}</style>
      </aside>
    </>
  );
}

function Header({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const customers = useCustomers();
  const loans = useLoans();
  const daybook = useDaybook();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between border-b bg-white px-6"
      style={{
        height: 64,
        left: 0,
        borderColor: "rgba(74,111,165,0.10)",
      }}
    >
      {/* Global search trigger */}
      <div className="flex max-w-xl flex-1 items-center gap-3 md:ml-64">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-white text-slate-700 transition-colors hover:bg-slate-50 md:hidden"
          style={{ borderColor: "rgba(74,111,165,0.18)" }}
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50/50 sm:flex"
          style={{
            borderColor: "rgba(74,111,165,0.18)",
            color: "var(--text-muted)",
          }}
        >
          <Search size={16} />
          <span>Search customers, loans, receipts…</span>
          <div className="ml-auto flex items-center gap-1 opacity-60">
            <Kbd className="bg-slate-50">Ctrl</Kbd>
            <Kbd className="bg-slate-50">K</Kbd>
          </div>
        </button>

        <CommandDialog open={open} onOpenChange={setOpen}>
          <CommandInput placeholder="Type to search..." />
          <CommandList className="max-h-[70vh]">
            <CommandEmpty>No results found.</CommandEmpty>
            
            {/* Customers */}
            {customers.length > 0 && (
              <CommandGroup heading="Customers">
                {customers.slice(0, 10).map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.fullName} ${c.phone} ${c.id}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate("/customers");
                    }}
                  >
                    <Users className="mr-2 h-4 w-4 opacity-70" />
                    <div className="flex flex-col">
                      <span className="font-medium">{c.fullName}</span>
                      <span className="text-[10px] opacity-60">
                        {c.id} • {c.phone}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* Loans */}
            {loans.length > 0 && (
              <CommandGroup heading="Active Loans">
                {loans.slice(0, 10).map((l) => (
                  <CommandItem
                    key={l.id}
                    value={`${l.id} ${l.customer} ${l.vehicleDetails?.regNo ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate(`/loans/${l.id}`);
                    }}
                  >
                    <Banknote className="mr-2 h-4 w-4 opacity-70" />
                    <div className="flex flex-col">
                      <span className="font-medium">{l.id}</span>
                      <span className="text-[10px] opacity-60">
                        {l.customer} • {l.product}
                        {l.vehicleDetails?.regNo ? ` • ${l.vehicleDetails.regNo}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* Daybook / Transactions */}
            {daybook.length > 0 && (
              <CommandGroup heading="Transactions">
                {daybook.slice(0, 10).map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`${e.id} ${e.particulars} ${e.refId ?? ""}`}
                    onSelect={() => {
                      setOpen(false);
                      navigate("/receipts-ledger");
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4 opacity-70" />
                    <div className="flex flex-col">
                      <span className="font-medium">{e.particulars}</span>
                      <span className="text-[10px] opacity-60">
                        {e.id} • {e.dateIso} • ₹{e.amount.toLocaleString()}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </CommandDialog>
      </div>

      {/* Right cluster */}
      <div className="ml-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "rgba(100,116,139,0.08)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
          }}
        >
          <Bell size={20} />
        </button>

        {/* Identity pill — clicking it routes to the Profile Hub. The role
            label flips to "Staff" / "Administrator" based on the user's
            actual role from `useAuth`. */}
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors"
          style={{ backgroundColor: "var(--brand-light)" }}
          aria-label="Open profile"
        >
          <UserCircle size={28} style={{ color: "var(--text-main)" }} />
          <div className="leading-tight text-left">
            <div
              className="text-xs font-semibold"
              style={{ color: "var(--text-main)" }}
            >
              {user?.name ?? "—"}
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {user?.role === "ADMIN" ? "Administrator" : "Staff"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
          style={{ color: "#030213" }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  const [activeVertical, setActiveVertical] = useState<Vertical>("PAWN");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-main)" }}>
      <Sidebar
        vertical={activeVertical}
        onChangeVertical={setActiveVertical}
        isAdmin={isAdmin}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
      <Header
        onToggleSidebar={() => setIsMobileSidebarOpen(true)}
      />
      <main
        className="pt-16 md:pl-64"
        style={{ minHeight: "100vh" }}
      >
        <div className="p-8">
          {children ?? (
            <Outlet context={{ activeVertical, setActiveVertical }} />
          )}
        </div>
      </main>
    </div>
  );
}
