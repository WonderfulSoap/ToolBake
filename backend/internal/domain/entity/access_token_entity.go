package entity

import "time"

type AccessToken struct {
	UserID   UserIDEntity
	Token    string
	IssueAt  time.Time
	ExpireAt time.Time

	RelativeRefreshToken string
}

func NewAccessToken(userID UserIDEntity, token string, issueAt, expireAt time.Time, relativeRefreshToken string) AccessToken {
	return AccessToken{
		UserID:               userID,
		Token:                token,
		IssueAt:              issueAt,
		ExpireAt:             expireAt,
		RelativeRefreshToken: relativeRefreshToken,
	}
}
