package requestid

import (
	"context"
	"time"
	"ya-tool-craft/internal/error_code"
)

func GetRequestStartTime(ctx context.Context) time.Time {
	if ctx == nil {
		panic(error_code.NewErrorWithErrorCodef(error_code.InternalServerError, "get request start time from context failed, context is nil"))
	}
	v := ctx.Value("request-start-time")
	if v == nil {
		return time.Time{}
	}
	startTime, ok := v.(time.Time)
	if !ok {
		return time.Time{}
	}
	return startTime
}
