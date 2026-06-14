import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const memoryStorage = new Map<string, string>();

beforeEach(() => {
  memoryStorage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
