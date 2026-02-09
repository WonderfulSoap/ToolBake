import { ErrorCodeErrorCodeConst } from "~/data/generated-http-client";
import { ApiError } from "~/data/http-client/api-error";

type GlobalErrorReporter = (source: string, message?: string, error?: unknown, showPopup?: boolean) => void;
type ForceLogout = () => void;

export class ErrorHandler {

  static processError(error: unknown): void {
    if (ErrorHandler.isInvalidRefreshToken(error) || ErrorHandler.isForceLogoutErrorMessage(error)) throw error;
  }

  static registerGlobalListeners(forceLogout: ForceLogout, reportError: GlobalErrorReporter): () => void {
    if (typeof window === "undefined") return () => undefined;
    const handleGlobalError = (event: ErrorEvent) => {
      const message = event?.error instanceof Error ? event.error.message : event?.message ?? "Unexpected error occurred.";
      const isLogoutError = ErrorHandler.isForceLogoutErrorMessage(message);
      if (ErrorHandler.isInvalidRefreshToken(event?.error)) {
        console.log("Detected invalid refresh token, force logout");
        forceLogout();
        reportError("global-error", "It seems like your session has expired. You have been logged out.", event?.error ?? event, true);
        return;
      }
      const shouldShowPopup = isLogoutError || ErrorHandler.isApiError(event?.error) || message.indexOf("HTTPClient Error:") > 0;
      reportError("global-error", message, event?.error ?? event, shouldShowPopup);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const message = reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unexpected error occurred.";
      const isLogoutError = ErrorHandler.isForceLogoutErrorMessage(message);
      if (ErrorHandler.isInvalidRefreshToken(event?.reason)) {
        console.log("Detected invalid refresh token, force logout");
        forceLogout();
        reportError("global-error", "It seems like your session has expired. You have been logged out.", reason ?? event, true);
        return;
      }
      const shouldShowPopup = isLogoutError || ErrorHandler.isApiError(reason);
      reportError("global-error", message, reason ?? event, shouldShowPopup);
    };
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }

  static isInvalidCredentials(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_INVALID_CREDENTIALS;
  }

  static isInvalidAccessToken(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_INVALID_ACCESS_TOKEN;
  }

  static isInvalidRefreshToken(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_INVALID_REFRESH_TOKEN;
  }

  static isFileNotFound(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_FILE_NOT_FOUND;
  }

  static isForceLogoutErrorMessage(error: unknown): boolean {
    const message = typeof error === "string" ? error : error instanceof Error ? error.message : null;
    return typeof message === "string" && message.startsWith("Logout:");
  }

  static isTwoFaTotpIsRequiredForLogin(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_TWO_FA_TOTP_IS_REQUIRED_FOR_LOGIN;
  }

  static  isInvalidRecoveryCode(error: unknown): boolean {
    return ErrorHandler.isApiError(error) && error.code === ErrorCodeErrorCodeConst.ERROR_CODE_INVALID_RECOVERY_CODE;
  }
}
