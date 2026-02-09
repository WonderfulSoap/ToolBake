package entity

import (
	"time"
	"ya-tool-craft/internal/utils"
)

type RefreshToken struct {
	UserID   UserIDEntity
	Token    string
	IssueAt  time.Time
	ExpireAt time.Time

	TokenHash string
}

func NewRefreshToken(userID UserIDEntity, token string, issueAt, expireAt time.Time) RefreshToken {
	return RefreshToken{
		UserID:    userID,
		Token:     token,
		IssueAt:   issueAt,
		ExpireAt:  expireAt,
		TokenHash: utils.Sha256String(token),
	}
}
