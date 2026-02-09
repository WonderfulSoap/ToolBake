package common

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/requestid"
	"ya-tool-craft/internal/error_code"

	"net/http"

	"github.com/gin-gonic/gin"
)

type JsonResponse struct {
}

func (j *JsonResponse) Success(ctx *gin.Context, message string, data any) {

	ctx.JSON(http.StatusOK, gin.H{
		"status":     "ok",
		"message":    message,
		"data":       data,
		"request_id": requestid.GetRequestID(ctx),
	})
}

func (j *JsonResponse) SuccessWithCachedJsonString(ctx *gin.Context, message, objectJsonString string) {
	bodyStr, err := json.Marshal(gin.H{
		"status":     "ok",
		"message":    message,
		"data":       "{{DATA_PLACEHOLDER}}",
		"request_id": requestid.GetRequestID(ctx),
	})
	if err != nil {
		j.Error(ctx, error_code.NewErrorWithErrorCode(error_code.InternalServerError, "fail genearte cached json response"))
		return
	}
	// finalStr := strings.Replace(string(bodyStr), `"{{DATA_PLACEHOLDER}}"`, objectJsonString, 1)
	finalBody := bytes.Replace(bodyStr, []byte(`"{{DATA_PLACEHOLDER}}"`), []byte(objectJsonString), 1)
	ctx.Data(http.StatusOK, "application/json", finalBody)
}

func (j *JsonResponse) Error(ctx *gin.Context, err error) {
	// Keep full multiline stack in local/test for readability; emit single-line logs with literal "\n" in other envs.
	env := config.GetEnvName()
	if env == "local" || env == "test" {
		logger.Errorf(ctx, "%+v", err)
	} else {
		escapedNewlineErr := strings.ReplaceAll(fmt.Sprintf("%+v", err), "\r\n", "\n")
		escapedNewlineErr = strings.ReplaceAll(escapedNewlineErr, "\n", "\\n")
		logger.Errorf(ctx, "%s", escapedNewlineErr)
	}

	// check error is error_code.ErrorWithErrorCode
	var e error_code.ErrorWithErrorCode
	if errors.As(err, &e) {
		httpStatusCode := e.ErrorCode.HTTPStatusCode
		code := e.ErrorCode.Code
		message := e.ErrorCode.Message
		extraMessage := e.ExtraMessage
		if extraMessage != "" {
			message = fmt.Sprintf("%s, %s", message, extraMessage)
		}

		var extraData any = nil
		if e.ExtraData != nil {
			extraData = e.ExtraData
		}

		ctx.JSON(httpStatusCode, gin.H{
			"status":     "error",
			"error_code": code,
			"message":    message,
			"extra_data": extraData,
			"request_id": requestid.GetRequestID(ctx),
		})
	} else {
		httpStatusCode := error_code.InternalServerError.HTTPStatusCode
		code := error_code.InternalServerError.Code
		message := error_code.InternalServerError.Message

		ctx.JSON(httpStatusCode, gin.H{
			"status":     "error",
			"error_code": code,
			"message":    fmt.Sprintf("%s, %s", message, err.Error()),
			"request_id": requestid.GetRequestID(ctx),
		})
	}
	ctx.Abort()

}
