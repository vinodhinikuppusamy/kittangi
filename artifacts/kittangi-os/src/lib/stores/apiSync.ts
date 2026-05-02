/**
 * apiSync.ts — thin helpers for syncing frontend stores with backend APIs.
 *
 * Strategy:
 *   1. On sign-in, fetch collections from the API and hydrate in-memory stores.
 *   2. On mutations, forward creates/updates/deletes to the API.
 */
import { API_BASE_URL } from "@/lib/apiBase";

// Token getter registered after login
let _token: string | null = null;

export function setApiToken(token: string | null): void {
  _token = token;
}

export function getApiToken(): string | null {
  return _token;
}

export const API_BASE = API_BASE_URL;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (_token) h["Authorization"] = `Bearer ${_token}`;
  return h;
}

async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  try {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const resp = await fetch(`${API_BASE}${normalizedPath}`, {
      method,
      headers: authHeaders(),
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) return null;
    if (resp.status === 204) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

// ─── Pull helpers (hydrate in-memory stores from API) ───────────────────────

export async function fetchAll<T>(path: string): Promise<T[] | null> {
  return apiFetch<T[]>("GET", path);
}

export async function fetchOne<T>(path: string): Promise<T | null> {
  return apiFetch<T>("GET", path);
}

// ─── Push helpers (write store mutations to API) ──────────────────────────────

export async function apiCreate<T>(path: string, body: T): Promise<void> {
  await apiFetch("POST", path, body);
}

export async function apiUpdate(path: string, id: string, body: unknown): Promise<void> {
  await apiFetch("PATCH", `${path}/${encodeURIComponent(id)}`, body);
}

export async function apiDelete(path: string, id: string): Promise<void> {
  await apiFetch("DELETE", `${path}/${encodeURIComponent(id)}`);
}

export async function apiPut(path: string, body: unknown): Promise<void> {
  await apiFetch("PUT", path, body);
}

export async function apiPost(path: string, body: unknown): Promise<void> {
  await apiFetch("POST", path, body);
}
