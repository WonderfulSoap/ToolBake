package error_code

//go:generate go run ../../cmd/error_code_const_gen

type ErrorCode struct {
	Code           string
	Message        string
	HTTPStatusCode int
}

var ErrorCodeList = []ErrorCode{}

func reg(errorCode ErrorCode) ErrorCode {
	ErrorCodeList = append(ErrorCodeList, errorCode)
	return errorCode
}

var (
	// SystemError
	InternalServerError      = reg(ErrorCode{"InternalServerError", "Internal server error", 500})
	InvalidRequestParameters = reg(ErrorCode{"InvalidParameters", "Invalid Request parameters", 400})

	// AuthError
	Unauthorized                    = reg(ErrorCode{"Unauthorized", "Unauthorized", 401})
	InvalidAccessToken              = reg(ErrorCode{"InvalidAccessToken", "Invalid access token", 401})
	InvalidRefreshToken             = reg(ErrorCode{"InvalidRefreshToken", "Invalid refresh token", 401})
	TokenNotFound                   = reg(ErrorCode{"TokenNotFound", "Token not found", 401})
	OauthTokenUnavailable           = reg(ErrorCode{"OauthTokenUnavailable", "OAuth token unavailable", 400})
	PasswordLoginIsNotEnabled       = reg(ErrorCode{"PasswordLoginIsNotEnabled", "Password login is not enabled", 403})
	SSOProviderAccountAlreadyBinded = reg(ErrorCode{"SSOProviderAccountAlreadyBinded", "A SSO provider account is already binded to this user, please remove binding first", 409})
	CannotDeleteLastSSOBinding      = reg(ErrorCode{"CannotDeleteLastSSOBinding", "Cannot delete the last SSO binding, user must have at least one login method", 400})
	TwoFaAlreadyEnabled             = reg(ErrorCode{"TwoFaAlreadyEnabled", "Two-factor authentication is already enabled", 409})
	TwoFaTotpIsRequiredForLogin     = reg(ErrorCode{"TwoFaTotpIsRequiredForLogin", "Two-factor TOTP code is required for login", 401})
	InvalidRecoveryCode             = reg(ErrorCode{"InvalidRecoveryCode", "Invalid recovery code", 400})

	InvalidTotpCode = reg(ErrorCode{"InvalidTotpCode", "Invalid TOTP code", 400})
	// UserError
	UserNotFound       = reg(ErrorCode{"UserNotFound", "User not found", 404})
	InvalidCredentials = reg(ErrorCode{"InvalidCredentials", "Invalid username or password", 401})
	UserAlreadyExists  = reg(ErrorCode{"UserAlreadyExists", "User already exists", 409})
	Forbidden          = reg(ErrorCode{"Forbidden", "Forbidden", 403})

	// FileStorageError
	FileNotFound         = reg(ErrorCode{"FileNotFound", "File not found", 404})
	FileAlreadyExists    = reg(ErrorCode{"FileAlreadyExists", "File already exists", 409})
	DirectoryNotFound    = reg(ErrorCode{"DirectoryNotFound", "Directory not found", 404})
	InvalidFilePath      = reg(ErrorCode{"InvalidFilePath", "Invalid file path", 400})
	InvalidParameter     = reg(ErrorCode{"InvalidParameter", "Invalid parameter", 400})
	FileOperationFailed  = reg(ErrorCode{"FileOperationFailed", "File operation failed", 500})
	FileTooLarge         = reg(ErrorCode{"FileTooLarge", "File size exceeds limit", 413})
	InvalidFileType      = reg(ErrorCode{"InvalidFileType", "Invalid file type", 400})
	StorageQuotaExceeded = reg(ErrorCode{"StorageQuotaExceeded", "Storage quota exceeded", 507})
)
