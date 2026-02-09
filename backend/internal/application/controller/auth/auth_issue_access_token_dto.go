package auth

import (
	"time"
	"ya-tool-craft/internal/domain/entity"
)

type IssueAccessTokenRequestDto struct {
	RefreshToken string `json:"refresh_token" binding:"required" example:"refresh_token_a"`
}

type IssueAccessTokenResponseDto struct {
	AccessToken          string `json:"access_token" example:"access_token_a"`
	AccessTokenExpiresIn string `json:"expires_in" example:"2024-12-31T23:59:59Z" format:"date-time"`
}

func (d *IssueAccessTokenResponseDto) FromEntity(accessToken entity.AccessToken) {
	d.AccessToken = accessToken.Token
	d.AccessTokenExpiresIn = accessToken.ExpireAt.Format(time.RFC3339)
}
