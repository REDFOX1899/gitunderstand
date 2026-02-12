import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encrypt, decrypt } from "./encryption";

// A valid 64-hex-char key (32 bytes)
const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a simple string", () => {
    const plaintext = "sk-ant-api03-test-key-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both decrypt to the same value
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    expect(decrypt(encrypted)).toBe("");
  });

  it("handles unicode and special characters", () => {
    const plaintext = "key-with-émojis-🔑-and-日本語";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("handles long API keys", () => {
    const plaintext = "sk-ant-api03-" + "a".repeat(200);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("throws when ENCRYPTION_KEY is missing", () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("throws when ENCRYPTION_KEY is wrong length", () => {
    vi.stubEnv("ENCRYPTION_KEY", "too-short");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("fails to decrypt with a different key", () => {
    const encrypted = encrypt("secret");

    // Switch to a different key
    vi.stubEnv(
      "ENCRYPTION_KEY",
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    );

    expect(() => decrypt(encrypted)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    // Tamper with the base64 content by flipping a character
    const tampered =
      encrypted.slice(0, 10) +
      (encrypted[10] === "A" ? "B" : "A") +
      encrypted.slice(11);

    expect(() => decrypt(tampered)).toThrow();
  });

  it("output is valid base64", () => {
    const encrypted = encrypt("test");
    expect(() => Buffer.from(encrypted, "base64")).not.toThrow();
    // Roundtrip base64 should match
    expect(Buffer.from(encrypted, "base64").toString("base64")).toBe(encrypted);
  });
});
