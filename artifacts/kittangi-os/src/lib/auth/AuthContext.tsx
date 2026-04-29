import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ensureSeedPasswordsHashed,
  findUserByUsername,
  getUser,
  updateUser,
  useUsers,
  type User,
  type UserRole,
} from "@/lib/stores/usersStore";
import { setUserRole } from "@/lib/stores/userRoleStore";

/**
 * AuthContext — single source of truth for "who is currently signed in".
 *
 * Persists the current user id in localStorage so a full page refresh keeps
 * the session alive (matches the rest of the app's persistence model). On
 * sign-in we also push the role into the legacy `userRoleStore` so existing
 * `useIsAdmin()` callsites keep working without a wholesale refactor.
 */

const SESSION_KEY = "kittangi:session:v1";

type SignInResult = { ok: true } | { ok: false; reason: string };

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
  /**
   * Update the currently-signed-in user's password. Requires the existing
   * password to be re-entered for confirmation. Returns an error reason on
   * failure (mismatched current password, weak new password, etc.).
   */
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<SignInResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function sha256Hex(salt: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(salt + password),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

function persistStoredUserId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id == null) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(id));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // We subscribe to the users list so a password change / role flip via the
  // Settings tab is reflected here without a remount.
  const users = useUsers();
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    loadStoredUserId(),
  );
  const [ready, setReady] = useState(false);

  // On first paint, rehash any default seed passwords so the demo logins
  // ("anita / kittangi123" etc.) work even though the seed file ships with
  // placeholder hashes for offline boot.
  useEffect(() => {
    let alive = true;
    ensureSeedPasswordsHashed()
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Keep the legacy `userRoleStore` in sync so existing `useIsAdmin()` callers
  // keep working without code changes.
  const user = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId],
  );
  useEffect(() => {
    if (user) setUserRole(user.role as UserRole);
  }, [user]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const candidate = findUserByUsername(username);
      if (!candidate) return { ok: false, reason: "Unknown username." };
      if (candidate.status !== "ACTIVE")
        return { ok: false, reason: "This account is inactive." };
      const hashed = await sha256Hex(candidate.passwordSalt, password);
      if (hashed !== candidate.passwordHash)
        return { ok: false, reason: "Incorrect password." };
      setCurrentUserId(candidate.id);
      persistStoredUserId(candidate.id);
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(() => {
    setCurrentUserId(null);
    persistStoredUserId(null);
  }, []);

  const updatePassword = useCallback<
    AuthContextValue["updatePassword"]
  >(
    async (currentPassword, newPassword) => {
      if (!currentUserId)
        return { ok: false, reason: "You are not signed in." };
      const u = getUser(currentUserId);
      if (!u) return { ok: false, reason: "Your account no longer exists." };
      if (newPassword.length < 6)
        return {
          ok: false,
          reason: "New password must be at least 6 characters.",
        };
      const verify = await sha256Hex(u.passwordSalt, currentPassword);
      if (verify !== u.passwordHash)
        return { ok: false, reason: "Current password is incorrect." };
      const newSalt = randomSalt();
      const newHash = await sha256Hex(newSalt, newPassword);
      updateUser(u.id, { passwordSalt: newSalt, passwordHash: newHash });
      return { ok: true };
    },
    [currentUserId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, signIn, signOut, updatePassword }),
    [user, ready, signIn, signOut, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Helpers used outside the React tree (e.g. from utilities) — they expose the
 * common "create a user with a freshly-hashed password" flow used by the
 * Settings → Add User dialog.
 */
export async function makeUserCredentials(
  password: string,
): Promise<{ passwordSalt: string; passwordHash: string }> {
  const salt = randomSalt();
  const hash = await sha256Hex(salt, password);
  return { passwordSalt: salt, passwordHash: hash };
}
