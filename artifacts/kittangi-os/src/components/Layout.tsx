import { useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu, Search, UserCircle, X } from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_NAV,
  CAPITAL_NAV,
  getNavForVertical,
  type NavItem,
  type Vertical,
} from "@/lib/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

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
      <div className="relative">
        <select
          id="vertical-switcher"
          value={value}
          onChange={(e) => onChange(e.target.value as Vertical)}
          className="w-full appearance-none rounded-lg border-2 bg-white px-3 py-2.5 pr-9 text-sm font-semibold outline-none transition-colors focus:ring-4"
          style={{
            borderColor: "var(--brand-primary)",
            color: "var(--brand-primary)",
            backgroundColor: "#fff",
            // @ts-expect-error custom CSS var for ring color via Tailwind ring utility fallback
            "--tw-ring-color": "var(--brand-light)",
          }}
        >
          <option value="PAWN">Pawn Broking</option>
          <option value="VEHICLE">Vehicle Finance</option>
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--brand-primary)" }}
        />
      </div>
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
          background-color: var(--brand-light);
          color: var(--brand-primary);
        }
        .hover-link:hover svg {
          color: var(--brand-primary);
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
      {/* Global search */}
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

        <div
          className="hidden w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors focus-within:ring-4 sm:flex"
          style={{
            borderColor: "rgba(74,111,165,0.18)",
            // @ts-expect-error CSS var
            "--tw-ring-color": "var(--brand-light)",
          }}
        >
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <input
            type="search"
            placeholder="Search customers, loans, receipts…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-muted)]"
          />
        </div>
      </div>

      {/* Right cluster */}
      <div className="ml-6 flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
          style={{ color: "var(--brand-primary)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--brand-light)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "transparent";
          }}
        >
          <Bell size={20} />
          <span
            className="absolute top-2 right-2 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "#EF4444" }}
          />
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
          <UserCircle size={28} style={{ color: "var(--brand-primary)" }} />
          <div className="leading-tight text-left">
            <div
              className="text-xs font-semibold"
              style={{ color: "var(--brand-primary)" }}
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
          style={{ color: "#B91C1C" }}
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
