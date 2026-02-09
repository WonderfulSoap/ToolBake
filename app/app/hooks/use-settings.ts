import { useMutation, useQuery } from "@tanstack/react-query";
import type { Settings } from "~/entity/settings";
import { globalDI } from "~/di/global-di";
import { ErrorHandler } from "~/error/error-checker";
import { queryClient } from "~/lib/query-client";

/**
 * Fetch settings using react-query.
 */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn : async () => {
      try {
        return await globalDI.settingRepository.get();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
  });
}

/**
 * Save a full settings snapshot and invalidate cache.
 */
export function useSaveSettings() {
  return useMutation({
    mutationFn: async (settings: Settings) => {
      try {
        await globalDI.settingRepository.save(settings);
        return settings;
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
