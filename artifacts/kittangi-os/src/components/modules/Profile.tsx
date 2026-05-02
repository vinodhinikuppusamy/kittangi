import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";
 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthContext";
 
/**
 * Profile Hub. Displays the signed-in user's identity + role, lets them
 * change their password, and provides the global Sign-Out action. The page
 * is rendered inside the standard `<Layout>` so the navigation chrome
 * remains familiar.
 */
export default function Profile() {
  const { user, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);
 
  if (!user) return null; // Guarded by RequireAuth — defensive fallback only.
 
  const handlePasswordChange = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("Passwords don't match");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(currentPwd, newPwd);
    setSubmitting(false);
    if (!result.ok) {
      toast.error("Couldn't update password", { description: result.reason });
      return;
    }
    toast.success("Password updated");
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
  };
 
  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };
 
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      {/* Identity card */}
      <Card
        className="border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.15)" }}
      >
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-white text-2xl font-bold"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCircle size={12} />
                <span className="font-mono">{user.username}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Mail size={12} />
                {user.email}
              </div>
              <div className="pt-1">
                <Badge
                  className="border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    background:
                      user.role === "ADMIN"
                        ? "rgba(74,111,165,0.14)"
                        : "rgba(100,116,139,0.12)",
                    color: user.role === "ADMIN" ? "#1d4ed8" : "#475569",
                    borderColor:
                      user.role === "ADMIN"
                        ? "rgba(74,111,165,0.35)"
                        : "rgba(100,116,139,0.30)",
                  }}
                >
                  <ShieldCheck size={10} className="mr-1" />
                  {user.role === "ADMIN" ? "Administrator" : "Staff"}
                </Badge>
              </div>
            </div>
          </div>
 
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOut}
            className="font-semibold"
            style={{ color: "#B91C1C", borderColor: "rgba(185,28,28,0.30)" }}
          >
            <LogOut size={14} className="mr-1.5" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
 
      {/* Password change */}
      <Card
        className="border bg-white"
        style={{ borderColor: "rgba(74,111,165,0.15)" }}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: "rgba(245,158,11,0.14)",
                boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.32)",
              }}
            >
              <KeyRound
                className="h-5 w-5"
                style={{ color: "#b45309" }}
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Change Password
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Pick a new password — minimum 6 characters.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handlePasswordChange}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="cur-pwd" className="text-xs font-semibold">
                Current Password
              </Label>
              <Input
                id="cur-pwd"
                type="password"
                autoComplete="current-password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-pwd" className="text-xs font-semibold">
                New Password
              </Label>
              <Input
                id="new-pwd"
                type="password"
                autoComplete="new-password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirm-pwd" className="text-xs font-semibold">
                Confirm New Password
              </Label>
              <Input
                id="confirm-pwd"
                type="password"
                autoComplete="new-password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button
                type="submit"
                disabled={submitting}
                className="font-semibold text-white"
                style={{ background: "var(--brand-primary)" }}
              >
                {submitting ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}