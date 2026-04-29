import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Sign-in screen. Accepts username (or email) + password and on success
 * redirects to either the originally-requested route (preserved on the
 * `state.from` prop by `RequireAuth`) or the dashboard.
 */
export default function Login() {
  const { user, ready, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fromPath =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  if (user) return <Navigate to={fromPath} replace />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    const result = await signIn(username, password);
    setSubmitting(false);
    if (!result.ok) {
      toast.error("Sign in failed", { description: result.reason });
      return;
    }
    toast.success("Welcome back");
    navigate(fromPath, { replace: true });
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm"
        style={{ borderColor: "rgba(74,111,165,0.15)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
            }}
          >
            K
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              Kittangi OS
            </h1>
            <p className="text-xs text-slate-500">
              Multi-vertical financial suite — staff sign-in
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username" className="text-xs font-semibold">
              Username or Email
            </Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="anita"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs font-semibold">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting || !ready}
            data-testid="button-sign-in"
            className="w-full"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "white",
            }}
          >
            <LogIn size={14} className="mr-1.5" />
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          For access, contact your branch administrator.
        </p>
      </div>
    </div>
  );
}
