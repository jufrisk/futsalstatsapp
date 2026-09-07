import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// jsdom's `crypto` may lack randomUUID; provide a deterministic shim for tests.
if (typeof globalThis.crypto?.randomUUID !== "function") {
  let counter = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      ...globalThis.crypto,
      randomUUID: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
    },
  });
}
