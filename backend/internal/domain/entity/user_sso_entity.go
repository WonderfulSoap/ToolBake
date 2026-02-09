package entity

import "time"

type UserSSOEntity struct {
	UserID           UserIDEntity
	Provider         string
	ProviderUserID   string
	ProviderUsername *string
	ProviderEmail    *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func NewUserSSOEntity(
	userID UserIDEntity,
	provider string,
	providerUserID string,
	providerUsername *string,
	providerEmail *string,
	createdAt time.Time,
	updatedAt time.Time,
) UserSSOEntity {
	return UserSSOEntity{
		UserID:           userID,
		Provider:         provider,
		ProviderUserID:   providerUserID,
		ProviderUsername: providerUsername,
		ProviderEmail:    providerEmail,
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
	}
}
