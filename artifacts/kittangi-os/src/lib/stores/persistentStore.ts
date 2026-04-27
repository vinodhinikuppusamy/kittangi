import { useSyncExternalStore } from "react";

type Listener = () => void;

export type PersistentStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: Listener) => () => void;
};

/**
 * Lightweight module-scope store backed by `window.localStorage`. Provides a
 * single source of truth that any number of React components can subscribe to
 * via `usePersistentStore`. Designed to keep the working model durable across
 * full-page refreshes without pulling in a heavyweight state library.
 *
 * NOTE: Image data is stored as base64 data URLs inside the JSON blob. Per
 * browser, localStorage is capped around 5 MB — sufficient for prototype use
 * with a handful of customer photos / item shots.
 */
export function createPersistentStore<T>(
  key: string,
  initial: T,
): PersistentStore<T> {
  const load = (): T => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      return JSON.parse(raw) as T;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Kittangi OS] Failed to load store "${key}":`, err);
      return initial;
    }
  };

  let state = load();
  const listeners = new Set<Listener>();

  const persist = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[Kittangi OS] Failed to persist store "${key}":`, err);
    }
  };

  return {
    get: () => state,
    set: (next) => {
      state =
        typeof next === "function"
          ? (next as (prev: T) => T)(state)
          : next;
      persist();
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function usePersistentStore<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
