package swagger

import "ya-tool-craft/internal/error_code"

type BaseSuccessResponse[T any] struct {
	Status    string `json:"status" example:"1"`
	Message   string `json:"message" example:""`
	Data      T      `json:"data"`
	RequestID string `json:"request_id" example:"3c55e76b-21b0-41e9-9780-206283053886"`
}

type BaseFailResponse struct {
	Status    string                    `json:"status" example:"error"`
	ErrorCode error_code.ErrorCodeConst `json:"error_code"`
	Message   string                    `json:"message" example:"Internal server error"`
	RequestID string                    `json:"request_id" example:"3c55e76b-21b0-41e9-9780-206283053886"`
}
