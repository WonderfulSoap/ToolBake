package user

import "ya-tool-craft/internal/domain/entity"

type UserInfoResponseDto struct {
	ID   string  `json:"id" example:"user_id_a"`
	Name string  `json:"name" example:"username"`
	Mail *string `json:"mail,omitempty" example:"user@example.com"`
}

func (c *UserInfoResponseDto) FromEntity(user entity.UserEntity) {
	c.ID = string(user.ID)
	c.Name = user.Name
	c.Mail = user.Mail
}
