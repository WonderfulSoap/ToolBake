package user

type CreateUserRequestDto struct {
	UserName string `json:"username" binding:"required,min=3,max=32" example:"username"`
	Password string `json:"password" binding:"required,max=32" example:"password"`
}

type CreateUserResponseDto struct {
}
