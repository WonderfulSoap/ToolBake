package requestid

import (
	"context"
	"ya-tool-craft/internal/error_code"
	"ya-tool-craft/internal/utils"
)

func GetRequestID(ctx context.Context) string {
	if ctx == nil {
		panic(error_code.NewErrorWithErrorCode(error_code.InternalServerError, "get request id from context failed, context is nil"))
	}

	if ctxWithValue, ok := ctx.(utils.ContextWithValue); ok {
		requestID, exist := ctxWithValue.Get("x-request-id")

		if !exist {
			return "UNKNOWN_REQUEST_ID"
		}
		requestIDStr, ok := requestID.(string)
		if !ok {
			return "UNKNOWN_REQUEST_ID"
		}
		return requestIDStr
	} else {
		requestID := ctx.Value("x-request-id")
		if requestID == nil || requestID == "" {
			return "UNKNOWN_REQUEST_ID"
		}
		requestIDStr, ok := requestID.(string)
		if !ok {
			return "UNKNOWN_REQUEST_ID"
		}
		return requestIDStr
	}

}
