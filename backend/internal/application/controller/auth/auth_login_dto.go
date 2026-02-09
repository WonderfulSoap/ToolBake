package auth

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

type LoginRequestDto struct {
	// username length should be between 3 and 32 characters
	UserName string `json:"username" binding:"required,min=3,max=32" example:"username"`
	// password length should be between 6 and 32 characters
	Password string `json:"password" binding:"required,max=32" example:"password"`
}

type LoginResponseDto struct {
	AccessToken           string `json:"access_token" example:"access_token_a"`
	AccessTokenExpiresIn  string `json:"expires_in" example:"2024-12-31T23:59:59Z" format:"date-time"`
	RefreshToken          string `json:"refresh_token" example:"refresh_token_a"`
	RefreshTokenExpiresIn string `json:"refresh_token_expires_in" example:"2024-12-31T23:59:59Z" format:"date-time"`
}

func (c *LoginResponseDto) FromEntity(accessToken entity.AccessToken, refreshToken entity.RefreshToken) {
	c.AccessToken = accessToken.Token
	c.AccessTokenExpiresIn = accessToken.ExpireAt.Format(time.RFC3339)
	c.RefreshToken = refreshToken.Token
	c.RefreshTokenExpiresIn = refreshToken.ExpireAt.Format(time.RFC3339)
}
