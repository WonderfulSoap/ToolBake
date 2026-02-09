import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingLocalStorageRepository, SETTINGS_STORAGE_KEY } from "./setting-local-storage-repository-impl";
import type { Settings } from "~/entity/settings";

// Simple in-memory storage stub for localStorage interactions.
class MockLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("SettingLocalStorageRepository", () => {
  let repository: SettingLocalStorageRepository;
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    const mockWindow = { localStorage: mockStorage } as unknown as Window & typeof globalThis;
    vi.stubGlobal("window", mockWindow);
    repository = new SettingLocalStorageRepository();
  });

  it("returns default settings when storage is empty", async () => {
    const result = await repository.get();
    expect(result).toEqual({ otherInfo: {} });
  });

  it("updates a single otherInfo key and persists the snapshot", async () => {
    const result = await repository.updateOtherInfoSetting("theme", "dark");
    expect(result).toEqual({ otherInfo: { theme: "dark" } });
    expect(readStoredSettings()).toEqual({ otherInfo: { theme: "dark" } });
  });

  it("overwrites stored settings on save", async () => {
    await repository.updateOtherInfoSetting("theme", "dark");
    await repository.save({ otherInfo: { locale: "en-US" } });
    expect(readStoredSettings()).toEqual({ otherInfo: { locale: "en-US" } });
  });

  it("removes invalid stored payload and falls back to defaults", async () => {
    mockStorage.setItem(SETTINGS_STORAGE_KEY, "not-json");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    const result = await repository.get();
    expect(result).toEqual({ otherInfo: {} });
    expect(mockStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("removes stored payload with invalid value types", async () => {
    mockStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ otherInfo: { count: 1 } }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    const result = await repository.get();
    expect(result).toEqual({ otherInfo: {} });
    expect(mockStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  // Helper to read stored settings from mockStorage.
  function readStoredSettings(): Settings | undefined {
    const raw = mockStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Settings) : undefined;
  }
});
