package auth

type TwoFALoginRequestDto struct {
	Token string `json:"token" binding:"required"` // token from login API when 2FA is required
	Code  string `json:"code" binding:"required"`  // 6-digit TOTP code from authenticator app
}

type TwoFALoginResponseDto struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}
