package user

type UpdateUserRequestDto struct {
	Username *string `json:"username,omitempty" binding:"omitempty,min=3,max=32" example:"new_username"`
}

type UpdateUserResponseDto struct {
}
