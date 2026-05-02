import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { setAuthTokenGetter } from "@workspace/api-client-react";
import { setUserRole } from "@/lib/stores/userRoleStore";
import type { UserRole } from "@/lib/stores/usersStore";
import { buildApiUrl } from "@/lib/apiBase";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
};

type StoredSession = { token: string; user: AuthUser };

type SignInResult = { ok: true } | { ok: false; reason: string };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<SignInResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let currentSession: StoredSession | null = null;

export function getCurrentAuthUser(): AuthUser | null {
  return currentSession?.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [ready, setReady] = useState(false);

  // Register the JWT token getter so every generated API call sends the bearer header
  useEffect(() => {
    currentSession = session;
    setAuthTokenGetter(() => session?.token ?? null);
  }, [session]);

  // Keep legacy userRoleStore in sync
  useEffect(() => {
    if (session?.user) setUserRole(session.user.role as UserRole);
  }, [session]);

  // Bootstrap from cookie-backed server session so refresh stays signed-in.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const resp = await fetch(buildApiUrl("/auth/me"), { credentials: "include" });
        if (!resp.ok) {
          if (!cancelled) setSession(null);
          return;
        }
        const user = (await resp.json()) as AuthUser;
        if (!cancelled) {
          setSession((prev) => ({ token: prev?.token ?? "", user }));
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      try {
        const resp = await fetch(buildApiUrl("/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        if (resp.status === 401 || resp.status === 403) {
          const body = (await resp.json()) as { message: string };
          return { ok: false, reason: body.message };
        }
        if (!resp.ok) {
          return { ok: false, reason: "Login failed. Please try again." };
        }
        const data = (await resp.json()) as { token?: string; user: AuthUser };
        const newSession: StoredSession = { token: data.token ?? "", user: data.user };
        setSession(newSession);
        return { ok: true };
      } catch {
        return { ok: false, reason: "Network error. Is the server running?" };
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    void fetch(buildApiUrl("/auth/logout"), { method: "POST", credentials: "include" });
    setSession(null);
  }, []);

  const updatePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<SignInResult> => {
      if (!session?.user) return { ok: false, reason: "Not signed in." };
      if (newPassword.length < 6)
        return { ok: false, reason: "New password must be at least 6 characters." };
      try {
        const resp = await fetch(buildApiUrl("/users/change-password"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        if (!resp.ok) {
          const body = (await resp.json()) as { message: string };
          return { ok: false, reason: body.message };
        }
        return { ok: true };
      } catch {
        return { ok: false, reason: "Network error." };
      }
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      ready,
      signIn,
      signOut,
      updatePassword,
    }),
    [session, ready, signIn, signOut, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Legacy helper â€” kept for compatibility with Settings â†’ Add User dialog */
export async function makeUserCredentials(
  _password: string,
): Promise<{ passwordSalt: string; passwordHash: string }> {
  // Not used in API mode â€” password is sent as plaintext over HTTPS and hashed server-side.
  // Returning stubs so TypeScript callers still compile.
  return { passwordSalt: "", passwordHash: "" };
}
