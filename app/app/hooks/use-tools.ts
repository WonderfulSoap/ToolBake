import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { UserToolMutation } from "~/data/interface/i-tool-repository";
import { globalDI } from "~/di/global-di";
import { ErrorHandler } from "~/error/error-checker";
import { useAuthContext } from "~/contexts/auth-context";
import { queryClient } from "~/lib/query-client";

/**
 * Fetch official tools using react-query
 */
export function useOfficialTools() {
  return useQuery({
    queryKey: ["tools", "official"],
    queryFn : async () => {
      try {
        return await globalDI.toolRepository.fetchOfficialTools();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
  });
}

/**
 * Fetch user tools using react-query
 * Automatically refetches when auth mode changes
 */
export function useUserTools() {
  const { mode } = useAuthContext();
  return useQuery({
    queryKey: ["tools", "user", mode],
    queryFn : async () => {
      try {
        return await globalDI.toolRepository.fetchUserTools();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
  });
}

/**
 * Get merged tool list (official + user tools)
 * Returns combined data and loading states
 */
export function useToolList() {
  const { data: officialTools = [], isLoading: isLoadingOfficial } = useOfficialTools();
  const { data: userTools = [], isLoading: isLoadingUser } = useUserTools();

  const toolList = useMemo(() => [...officialTools, ...userTools], [officialTools, userTools]);

  return {
    data     : toolList,
    officialTools,
    userTools,
    isLoading: isLoadingOfficial || isLoadingUser,
    isLoadingOfficial,
    isLoadingUser,
  };
}

/**
 * Create a new user tool
 * Invalidates user tools cache on success
 */
export function useCreateUserTool() {
  return useMutation({
    mutationFn: async (tool: UserToolMutation) => {
      try {
        return await globalDI.toolRepository.createUserTool(tool);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Update an existing user tool
 * Invalidates user tools cache on success
 */
export function useUpdateUserTool() {
  return useMutation({
    mutationFn: async ({ uid, updates }: { uid: string; updates: Partial<UserToolMutation> }) => {
      try {
        return await globalDI.toolRepository.updateUserTool(uid, updates);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Delete a user tool
 * Invalidates user tools cache on success
 */
export function useDeleteUserTool() {
  return useMutation({
    mutationFn: async (uid: string) => {
      try {
        return await globalDI.toolRepository.deleteUserTool(uid);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}
