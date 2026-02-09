import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/contexts/auth-context";
import { globalDI } from "~/di/global-di";
import { ErrorHandler } from "~/error/error-checker";
import { queryClient } from "~/lib/query-client";
import type { PasskeyLoginRequest } from "~/data/interface/i-auth-repository";

/**
 * Query: Get user info (auto-refetch when mode changes)
 * Only fetches when user is logged in
 */
export function useUserInfo() {
  const { mode } = useAuthContext();
  
  return useQuery({
    queryKey: ["user", "info", mode],
    queryFn : async () => {
      // Only fetch when logged in
      if (mode !== "logined") return null;
      
      try {
        return await globalDI.userRepository.getUserInfo();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    enabled: mode === "logined", // Only run query when logged in
  });
}

/**
 * Mutation: Login
 * Automatically updates mode in Context and invalidates user-related queries on success
 */
export function useLogin() {
  const { refreshMode } = useAuthContext();
  
  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        return await globalDI.authHelper.login(username, password);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      // Update mode in Context (triggers useUserInfo to refetch)
      refreshMode();
      
      // Invalidate all user-related queries
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Mutation: Login with Passkey
 * Automatically updates mode in Context and invalidates user-related queries on success
 */
export function useLoginWithPasskey() {
  const { refreshMode } = useAuthContext();

  return useMutation({
    mutationFn: async (credential: PasskeyLoginRequest) => {
      try {
        return await globalDI.authHelper.loginWithPasskey(credential);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      // Update mode in Context (triggers useUserInfo to refetch)
      refreshMode();

      // Invalidate all user-related queries
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Mutation: Logout
 * Automatically updates mode in Context and clears user-related caches on success
 */
export function useLogout() {
  const { refreshMode } = useAuthContext();
  
  return useMutation({
    mutationFn: async () => {
      try {
        return await globalDI.authHelper.logout();
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      // Update mode in Context
      refreshMode();
      
      // Clear all user-related data
      queryClient.removeQueries({ queryKey: ["user"] });
      queryClient.removeQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Mutation: Login with 2FA TOTP
 * Completes login flow when 2FA is required. Automatically updates mode and invalidates queries.
 */
export function useLoginWith2Fa() {
  const { refreshMode } = useAuthContext();

  return useMutation({
    mutationFn: async ({ token, code }: { token: string; code: string }) => {
      try {
        return await globalDI.authHelper.loginWith2Fa(token, code);
      } catch (error) {
        ErrorHandler.processError(error);
        throw error;
      }
    },
    onSuccess: () => {
      refreshMode();
      void queryClient.invalidateQueries({ queryKey: ["user"] });
      void queryClient.invalidateQueries({ queryKey: ["tools", "user"] });
    },
  });
}

/**
 * Convenience hook: Check if user is in guest mode
 */
export function useIsGuest() {
  const { mode } = useAuthContext();
  return mode !== "logined";
}
