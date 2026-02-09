import { useMutation, useQuery } from "@tanstack/react-query";
import { globalDI } from "~/di/global-di";
import { ErrorHandler } from "~/error/error-checker";
import { queryClient } from "~/lib/query-client";

/**
 * Fetch global script using react-query
 */
export function useGlobalScript() {
  return useQuery({
    queryKey: ["globalScript"],
    queryFn : async () => {
      try {
        return await globalDI.toolRepository.fetchGlobalScript();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
  });
}

/**
 * Save global script
 * Invalidates global script cache on success
 */
export function useSaveGlobalScript() {
  return useMutation({
    mutationFn: async (script: string) => {
      try {
        return await globalDI.toolRepository.saveGlobalScript(script);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["globalScript"] });
    },
  });
}
