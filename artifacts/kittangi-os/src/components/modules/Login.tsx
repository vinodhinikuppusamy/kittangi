import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        backgroundImage: "url('/kittangi background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 mx-auto min-h-screen w-full max-w-7xl px-6 py-10 lg:px-14">
        <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-12 lg:gap-16">
          {/* Left panel — logo */}
          <div className="hidden items-center justify-center md:flex">
            <img
              src="/kittangi.webp"
              alt="Kittangi"
              className="drop-shadow-2xl"
              style={{ width: "380px", maxWidth: "80%" }}
              draggable={false}
            />
          </div>

          {/* Right panel — login card */}
          <div className="flex w-full items-center justify-center">
            <div
              className="w-full max-w-107.5 rounded-3xl p-8 shadow-2xl"
              style={{
                background: "linear-gradient(160deg, #fff5f5 0%, #ffd6d9 100%)",
              }}
            >
              {/* Mobile logo */}
              <div className="mb-6 flex justify-center md:hidden">
                <img
                  src="/kittangi.webp"
                  alt="Kittangi"
                  className="w-36 drop-shadow"
                  draggable={false}
                />
              </div>

              <h2 className="mb-6 text-center text-2xl font-bold text-slate-800">
                Login
              </h2>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <Label
                    htmlFor="username"
                    className="mb-1.5 block text-sm font-medium text-slate-600"
                  >
                    Username
                  </Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or Email"
                    required
                    className="rounded-lg border-slate-200 bg-slate-50 focus:border-[#ff3a4c] focus:ring-[#ff3a4c]"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-slate-600"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-lg border-slate-200 bg-slate-50 pr-10 focus:border-[#ff3a4c] focus:ring-[#ff3a4c]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !ready}
                  data-testid="button-sign-in"
                  className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#ff3a4c" }}
                >
                  {submitting ? "Signing in…" : "Sign In"}
                </Button>
              </form>

              <div className="mt-7 border-t border-[#e6d9ca] pt-5 flex items-center justify-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">Powered by</span>
                <img
                  src="/ecs-powered-by.webp"
                  alt="ECS"
                  className="h-5 object-contain"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
