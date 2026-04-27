import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Bell, ChevronDown, Search, UserCircle } from "lucide-react";
import {
  ADMIN_NAV,
  CAPITAL_NAV,
  getNavForVertical,
  type NavItem,
  type Vertical,
} from "@/lib/navigation";

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
        className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text-muted)" }}
      >
        Active Vertical
      </label>
      <div className="relative">
        <select
          id="vertical-switcher"
          value={value}
          onChange={(e) => onChange(e.target.value as Vertical)}
          className="w-full appearance-none rounded-lg border-2 bg-white px-3 py-2.5 pr-9 text-sm font-semibold cursor-pointer outline-none transition-colors focus:ring-4"
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

function SidebarLinkList({ items }: { items: NavItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "is-active" : "hover-link",
                ].join(" ")
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      backgroundColor: "var(--brand-light)",
                      color: "var(--brand-primary)",
                    }
                  : { color: "var(--text-main)" }
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    style={{
                      color: isActive
                        ? "var(--brand-primary)"
                        : "var(--text-muted)",
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
}: {
  vertical: Vertical;
  onChangeVertical: (v: Vertical) => void;
}) {
  const items = getNavForVertical(vertical);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r"
      style={{
        width: 256,
        backgroundColor: "var(--sidebar-bg)",
        borderColor: "rgba(74, 111, 165, 0.12)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-5"
        style={{ height: 64, borderBottom: "1px solid rgba(74,111,165,0.10)" }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-bold text-sm"
          style={{
            background:
              "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
          }}
        >
          K
        </div>
        <div className="flex flex-col leading-tight">
          <span
            className="text-base font-bold"
            style={{ color: "var(--brand-primary)" }}
          >
            Kittangi OS
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Financial Suite
          </span>
        </div>
      </div>

      <AppSwitcher value={vertical} onChange={onChangeVertical} />

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <SidebarLinkList items={items} />

        {/* Capital section — vertical-agnostic */}
        <div className="mt-6 px-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Capital
          </p>
        </div>
        <div className="mt-2">
          <SidebarLinkList items={CAPITAL_NAV} />
        </div>

        {/* Administration section — vertical-agnostic, pinned below */}
        <div className="mt-6 px-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Administration
          </p>
        </div>
        <div className="mt-2">
          <SidebarLinkList items={ADMIN_NAV} />
        </div>
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
  );
}

function Header() {
  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between border-b bg-white px-6"
      style={{
        height: 64,
        left: 256,
        borderColor: "rgba(74,111,165,0.10)",
      }}
    >
      {/* Global search */}
      <div className="flex max-w-xl flex-1 items-center">
        <div
          className="flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors focus-within:ring-4"
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

        <div
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
          style={{ backgroundColor: "var(--brand-light)" }}
        >
          <UserCircle size={28} style={{ color: "var(--brand-primary)" }} />
          <div className="leading-tight">
            <div
              className="text-xs font-semibold"
              style={{ color: "var(--brand-primary)" }}
            >
              Admin User
            </div>
            <div
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              Administrator
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  const [activeVertical, setActiveVertical] = useState<Vertical>("PAWN");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-main)" }}>
      <Sidebar
        vertical={activeVertical}
        onChangeVertical={setActiveVertical}
      />
      <Header />
      <main
        className="pt-16 pl-64"
        style={{ minHeight: "100vh" }}
      >
        <div className="p-8">{children ?? <Outlet context={{ activeVertical }} />}</div>
      </main>
    </div>
  );
}
