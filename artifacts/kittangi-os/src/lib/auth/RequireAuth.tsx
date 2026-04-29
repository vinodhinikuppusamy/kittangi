import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Route gate. Redirects unauthenticated visitors to `/login`, preserving the
 * originally-requested URL so the post-sign-in handoff lands them back where
 * they meant to go.
 *
 * Optionally requires the signed-in user to hold a specific role
 * (`requireAdmin`). When a STAFF user hits an admin-only route they are
 * bounced to the dashboard with a brief query flag the receiving page can
 * use to show a "permission denied" toast if it wants.
 */
export default function RequireAuth({
  requireAdmin = false,
}: {
  requireAdmin?: boolean;
}) {
  const { user, ready } = useAuth();
  const location = useLocation();

  // Hold rendering until the auth context has booted (it does an async
  // `ensureSeedPasswordsHashed` on first paint). This avoids a flicker where
  // a logged-in user briefly sees the login page on hard refresh.
  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-main)" }}
      >
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (requireAdmin && user.role !== "ADMIN") {
    return <Navigate to="/dashboard?denied=1" replace />;
  }

  return <Outlet />;
}
