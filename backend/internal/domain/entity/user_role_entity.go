package entity

type UserRoleEntity struct {
	RoleName string
}

var (
	UserRoleAdmin = UserRoleEntity{RoleName: "admin"}
	UserRoleUser  = UserRoleEntity{RoleName: "user"}
)
