package entity

type GoogleUserInfoEntity struct {
	ID            string
	Email         string
	VerifiedEmail bool
	Name          string
	GivenName     string
	FamilyName    string
	Picture       string
	Locale        string
}

func NewGoogleUserInfoEntity(id string, email string, verifiedEmail bool, name string, givenName string, familyName string, picture string, locale string) GoogleUserInfoEntity {
	return GoogleUserInfoEntity{
		ID:            id,
		Email:         email,
		VerifiedEmail: verifiedEmail,
		Name:          name,
		GivenName:     givenName,
		FamilyName:    familyName,
		Picture:       picture,
		Locale:        locale,
	}
}
