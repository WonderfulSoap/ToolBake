package user

type CheckUsernameRequestDto struct {
	Username string `json:"username" binding:"required,min=1" example:"username"`
}

type CheckUsernameResponseDto struct {
	Exists bool `json:"exists" example:"true"`
}
