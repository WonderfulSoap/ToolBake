import { z } from "zod";
import type { Settings } from "~/entity/settings";
import type { ISettingRepository } from "../interface/i-setting-repository";

export const SETTINGS_STORAGE_KEY = "toolbake.settings";

const storedSettingsSchema = z.object({ otherInfo: z.record(z.string(), z.string()) });
type StoredSettings = z.infer<typeof storedSettingsSchema>;

/** Create the default settings payload when storage is empty or invalid. */
function buildDefaultSettings(): Settings {
  return { otherInfo: {} };
}

export class SettingLocalStorageRepository implements ISettingRepository {
  private readonly settingsStorageKey = SETTINGS_STORAGE_KEY;

  /** Load persisted settings or fall back to defaults. */
  async get(): Promise<Settings> {
    return this.readStoredSettings() ?? buildDefaultSettings();
  }

  /** Update a single setting key and persist the new snapshot. */
  async updateOtherInfoSetting(key: string, value: string): Promise<Settings> {
    const current = this.readStoredSettings() ?? buildDefaultSettings();
    const next: Settings = { otherInfo: { ...current.otherInfo, [key]: value } };
    this.persistSettings(next);
    return next;
  }

  /** Overwrite persisted settings with the incoming snapshot. */
  async save(settings: Settings): Promise<void> {
    this.persistSettings(settings);
  }

  /** Read and validate the stored settings payload. */
  private readStoredSettings(): Settings | undefined {
    const stored = this.readStoredItem(this.settingsStorageKey);
    if (stored === undefined) return undefined;
    try {
      const parsed = storedSettingsSchema.safeParse(JSON.parse(stored));
      if (!parsed.success) {
        console.error("Failed to parse stored settings", parsed.error);
        this.removeStoredItem(this.settingsStorageKey, "Failed to remove invalid settings");
        return undefined;
      }
      return parsed.data;
    } catch (error) {
      console.error("Failed to parse stored settings", error);
      this.removeStoredItem(this.settingsStorageKey, "Failed to remove invalid settings");
      return undefined;
    }
  }

  /** Persist a settings snapshot into localStorage. */
  private persistSettings(settings: Settings): void {
    const payload: StoredSettings = { otherInfo: { ...settings.otherInfo } };
    this.persistItem(this.settingsStorageKey, JSON.stringify(payload), "Failed to persist settings");
  }

  /** Read a raw item from storage. */
  private readStoredItem(key: string): string | undefined {
    const storage = this.resolveStorage();
    if (!storage) return undefined;
    try {
      const stored = storage.getItem(key);
      return stored === null ? undefined : stored;
    } catch (error) {
      console.error(`Failed to read stored settings (${key})`, error);
      return undefined;
    }
  }

  /** Persist a raw item into storage. */
  private persistItem(key: string, value: string, errorMessage: string): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch (error) {
      console.error(errorMessage, error);
    }
  }

  /** Remove a stored item for invalid payloads. */
  private removeStoredItem(key: string, errorMessage: string): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch (error) {
      console.error(errorMessage, error);
    }
  }

  /** Resolve localStorage when running in a browser context. */
  private resolveStorage(): Storage | null {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  }
}
