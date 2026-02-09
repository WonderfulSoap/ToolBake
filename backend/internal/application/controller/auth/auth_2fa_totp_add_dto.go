package auth

type TwoFATOTPAddRequestDto struct {
	Token string `json:"token" binding:"required"` // token from retrieve TOTP API
	Code  string `json:"code" binding:"required"`  // 6-digit TOTP code from authenticator app
}

type TwoFATOTPAddResponseDto struct {
	RecoveryCode string `json:"recovery_code"`
}


