package auth

type SSOLoginRequestDto struct {
	// username length should be between 3 and 32 characters
	OauthCode string `json:"oauth_code" binding:"required,min=1" example:"xxxxxxxxx"`
}
