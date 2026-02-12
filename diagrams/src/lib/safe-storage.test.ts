import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeGetItem, safeSetItem, safeRemoveItem } from "./safe-storage";

// Mock localStorage since vitest runs in Node
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

  const localStorageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
  };

  vi.stubGlobal("localStorage", localStorageMock);
});

describe("safeGetItem", () => {
  it("returns stored value", () => {
    mockStorage["testKey"] = "testValue";
    expect(safeGetItem("testKey")).toBe("testValue");
  });

  it("returns null for missing key", () => {
    expect(safeGetItem("nonexistent")).toBeNull();
  });

  it("returns null when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(safeGetItem("key")).toBeNull();
  });
});

describe("safeSetItem", () => {
  it("stores a value", () => {
    safeSetItem("key", "value");
    expect(mockStorage["key"]).toBe("value");
  });

  it("does not throw when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("full");
      },
    });
    expect(() => safeSetItem("key", "value")).not.toThrow();
  });
});

describe("safeRemoveItem", () => {
  it("removes a stored value", () => {
    mockStorage["key"] = "value";
    safeRemoveItem("key");
    expect(mockStorage["key"]).toBeUndefined();
  });

  it("does not throw when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => safeRemoveItem("key")).not.toThrow();
  });
});
