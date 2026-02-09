package entity

import "time"

type TwoFAType string

const (
	TwoFATypeTOTP TwoFAType = "totp"
)

type TwoFAEntity struct {
	ID        int64
	UserID    UserIDEntity
	Type      TwoFAType
	Secret    string
	Verified  bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

func NewTwoFAEntity(
	userID UserIDEntity,
	twoFAType TwoFAType,
	secret string,
) TwoFAEntity {
	now := time.Now()
	return TwoFAEntity{
		UserID:    userID,
		Type:      twoFAType,
		Secret:    secret,
		Verified:  false,
		CreatedAt: now,
		UpdatedAt: now,
	}
}
