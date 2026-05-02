import { useSyncExternalStore } from "react";

type Listener = () => void;

type StoreRecord = {
  setSnapshot: (next: unknown) => void;
};

const storeRegistry = new Map<string, StoreRecord>();

export type PersistentStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: Listener) => () => void;
};

export function hydratePersistentStore<T>(key: string, snapshot: T): void {
  const record = storeRegistry.get(key);
  if (!record) return;
  record.setSnapshot(snapshot);
}

/**
 * Lightweight module-scope store that any number of React components can
 * subscribe to via `usePersistentStore`. This is purely in-memory;
 * all durable state resides in the MongoDB backend and is synchronized
 * via the API server.
 */
export function createPersistentStore<T>(
  key: string,
  initial: T,
): PersistentStore<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  storeRegistry.set(key, {
    setSnapshot: (next) => {
      state = next as T;
      listeners.forEach((l) => l());
    },
  });

  return {
    get: () => state,
    set: (next) => {
      state =
        typeof next === "function"
          ? (next as (prev: T) => T)(state)
          : next;
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
