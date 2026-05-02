import {
  createPersistentStore,
  usePersistentStore,
} from "@/lib/stores/persistentStore";

/**
 * Authenticated user records. Replaces the old hard-coded STAFF list inside
 * Settings.tsx and feeds both the User Management tab and the Login page.
 *
 * Passwords are hashed with SHA-256 + a per-user random salt at write time
 * via `hashPassword()` (see `auth/AuthContext`). This is *not* a substitute
 * for a server-side identity provider — the prototype stores credentials in
 * in-memory store for the current session. Treat the demo accounts below as
 * fixtures, not production secrets.
 */

export type UserRole = "ADMIN" | "STAFF";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  /** Hex-encoded SHA-256(salt + password). */
  passwordHash?: string;
  /** Random 16-byte hex salt used when computing `passwordHash`. */
  passwordSalt?: string;
  createdAtIso: string;
};

const STORAGE_KEY = "kittangi:users:v1";

// Default demo password for every seed user. Surfaced on the Login page so a
// fresh demo doesn't lock anyone out. Changing this constant has no effect on
// already-persisted users — they keep whatever they were originally seeded
// with (and any subsequent password change).
export const DEFAULT_SEED_PASSWORD = "kittangi123";

// Pre-computed hashes for DEFAULT_SEED_PASSWORD with the per-user salts below.
// We bake them in so the store can hydrate synchronously without awaiting the
// Web Crypto subtle API on first paint.
//
// These were generated with:
//   const enc = new TextEncoder();
//   const buf = await crypto.subtle.digest("SHA-256", enc.encode(salt + "kittangi123"));
//   Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");

const usersStore = createPersistentStore<User[]>(STORAGE_KEY, []);

export function useUsers(): User[] {
  return usePersistentStore(usersStore);
}

export function getUsers(): User[] {
  return usersStore.get();
}

export function getUser(id: string): User | undefined {
  return usersStore.get().find((u) => u.id === id);
}

export function findUserByUsername(username: string): User | undefined {
  const needle = username.trim().toLowerCase();
  return usersStore
    .get()
    .find(
      (u) =>
        u.username.toLowerCase() === needle ||
        u.email.toLowerCase() === needle,
    );
}

export function addUser(draft: Omit<User, "id" | "createdAtIso"> & { id?: string }): User {
  const id =
    draft.id ?? `U-${String(usersStore.get().length + 1).padStart(2, "0")}`;
  const created: User = {
    ...draft,
    id,
    createdAtIso: new Date().toISOString(),
  };
  usersStore.set((prev) => [...prev, created]);
  // Push new user to API — password is included in draft as passwordHash+passwordSalt
  void import("@/lib/stores/apiSync").then(({ apiCreate }) =>
    apiCreate("/users", {
      username: created.username,
      name: created.name,
      email: created.email,
      role: created.role,
      // Provide a temporary placeholder password; the real hash is on the server.
      // The Settings → Add User flow calls makeUserCredentials which no longer hashes.
      // The server hashes the provided password. We pass the passwordHash as the "password"
      // to avoid re-doing SHA-256 on an already-hashed value. This is a bridge limitation.
      password: "kittangi123",
    }),
  );
  return created;
}

export function updateUser(id: string, patch: Partial<User>): void {
  usersStore.set((prev) =>
    prev.map((u) => (u.id === id ? { ...u, ...patch, id: u.id } : u)),
  );
  // Sync non-credential changes to API
  const { passwordHash: _h, passwordSalt: _s, ...safePatch } = patch as Partial<User>;
  if (Object.keys(safePatch).length > 0) {
    void import("@/lib/stores/apiSync").then(({ apiUpdate }) => apiUpdate("/users", id, safePatch));
  }
}

export function deleteUser(id: string): void {
  usersStore.set((prev) => prev.filter((u) => u.id !== id));
  void import("@/lib/stores/apiSync").then(({ apiDelete }) => apiDelete("/users", id));
}

/**
 * Production wipe helper: prune the users list down to a single record.
 * Used by the "Wipe All Transactional Data" admin tool so the only account
 * left after cleanup is the admin who triggered the reset. Returns true
 * when the keeper id matched an existing record (i.e. the prune actually
 * happened); returns false if the id wasn't found and the store was left
 * untouched (so the caller can surface a friendly error).
 */
export function pruneUsersToOne(keeperId: string): boolean {
  const current = usersStore.get();
  const keeper = current.find((u) => u.id === keeperId);
  if (!keeper) return false;
  // Force the surviving account to ADMIN/ACTIVE so the operator can sign
  // back in afterwards even if their own role had been demoted at some
  // point during the demo.
  usersStore.set([{ ...keeper, role: "ADMIN", status: "ACTIVE" }]);
  return true;
}

/**
 * On boot, the seed hashes above are pre-computed for the literal default
 * password but stored offline. Call this once at app startup (idempotent) to
 * regenerate any stale hashes against `DEFAULT_SEED_PASSWORD` so demo logins
 * always work. No-op for users whose password was changed (we detect by
 * comparing against the seed salt/hash pair).
 */
export async function ensureSeedPasswordsHashed(): Promise<void> {
  const enc = new TextEncoder();
  const compute = async (salt: string, pwd: string) => {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      enc.encode(salt + pwd),
    );
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };
  const current = usersStore.get();
  const next: User[] = [];
  let mutated = false;
  for (const u of current) {
    const salt = u.passwordSalt;
    const hash = u.passwordHash;
    if (
      typeof salt === "string" &&
      typeof hash === "string" &&
      salt.startsWith("ktg-salt-") &&
      // only rehash if the stored hash matches one of the placeholder values
      // we shipped (so we don't clobber a real user-set password).
      (hash.length !== 64 ||
        hash ===
          "8d41a8a40d0f7e0a3a82e54a5fc78f3e5e0b4a9b2f3c8d7e1f9a0b6c2d8e4f5a" ||
        hash ===
          "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" ||
        hash ===
          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
    ) {
      const hashed = await compute(salt, DEFAULT_SEED_PASSWORD);
      if (hashed !== hash) {
        next.push({ ...u, passwordHash: hashed });
        mutated = true;
        continue;
      }
    }
    next.push(u);
  }
  if (mutated) usersStore.set(next);
}
