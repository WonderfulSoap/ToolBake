import type { Settings } from "~/entity/settings";

export interface ISettingRepository {
  get(): Promise<Settings>
  updateOtherInfoSetting(key: string, value: string): Promise<Settings>
  save(settings: Settings): Promise<void>
}
