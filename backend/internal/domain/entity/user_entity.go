package entity

type UserEntity struct {
	ID   UserIDEntity
	Name string
	Mail *string

	PasswordHash *string
	Roles        []UserRoleEntity

	EncrypKey string

	SSOBindings []UserSSOEntity
}

// check use if has specific role
func (user UserEntity) HasRole(role UserRoleEntity) bool {
	for _, r := range user.Roles {
		if r.RoleName == role.RoleName {
			return true
		}
	}
	return false
}

func NewUserEntity(
	id UserIDEntity,
	name string,
	mail *string,
	passwordHash *string,
	roles []UserRoleEntity,
	encrypKey string,
) UserEntity {
	return UserEntity{
		ID:           id,
		Name:         name,
		Mail:         mail,
		PasswordHash: passwordHash,
		Roles:        roles,
		EncrypKey:    encrypKey,
	}
}
