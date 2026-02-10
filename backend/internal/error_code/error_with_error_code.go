package error_code

import (
	"fmt"

	"github.com/pkg/errors"
)

type ErrorWithErrorCode struct {
	ErrorCode    ErrorCode
	ExtraMessage string
	ExtraData    any
}

func (e ErrorWithErrorCode) Error() string {
	return fmt.Sprintf("error code: %s, %s, %s", e.ErrorCode.Code, e.ErrorCode.Message, e.ExtraMessage)
}

func NewErrorWithErrorCode(errorCode ErrorCode, extraMessage string) error {

	e := ErrorWithErrorCode{
		ErrorCode:    errorCode,
		ExtraMessage: extraMessage,
	}

	return errors.WithStack(e)
}

func NewErrorWithErrorCodeAppendExtraData(errorCode ErrorCode, extraData any, extraMessage string) error {

	e := ErrorWithErrorCode{
		ErrorCode:    errorCode,
		ExtraMessage: extraMessage,
		ExtraData:    extraData,
	}

	return errors.WithStack(e)
}

func NewErrorWithErrorCodef(errorCode ErrorCode, extraMessage string, args ...any) error {

	e := ErrorWithErrorCode{
		ErrorCode:    errorCode,
		ExtraMessage: fmt.Sprintf(extraMessage, args...),
	}

	return errors.WithStack(e)
}

func NewErrorWithErrorCodeFAppendExtraData(errorCode ErrorCode, extraData any, extraMessage string, args ...any) error {

	e := ErrorWithErrorCode{
		ErrorCode:    errorCode,
		ExtraMessage: fmt.Sprintf(extraMessage, args...),
		ExtraData:    extraData,
	}

	return errors.WithStack(e)
}
