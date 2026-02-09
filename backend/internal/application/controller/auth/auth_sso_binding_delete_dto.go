package auth

type SSOBindingDeleteRequestDto struct {
	Provider string `json:"provider" binding:"required"`
}
