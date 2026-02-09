package auth

import (
	"time"

	"ya-tool-craft/internal/domain/entity"
)

type SSOBindingDto struct {
	Provider         string    `json:"provider"`
	ProviderUserID   string    `json:"provider_user_id"`
	ProviderUsername *string   `json:"provider_username"`
	ProviderEmail    *string   `json:"provider_email"`
	CreatedAt        time.Time `json:"created_at"`
}

type SSOBindingGetResponseDto struct {
	Bindings []SSOBindingDto `json:"bindings"`
}

func (d *SSOBindingGetResponseDto) FromEntity(bindings []entity.UserSSOEntity) {
	d.Bindings = make([]SSOBindingDto, len(bindings))
	for i, binding := range bindings {
		d.Bindings[i] = SSOBindingDto{
			Provider:         binding.Provider,
			ProviderUserID:   binding.ProviderUserID,
			ProviderUsername: binding.ProviderUsername,
			ProviderEmail:    binding.ProviderEmail,
			CreatedAt:        binding.CreatedAt,
		}
	}
}
