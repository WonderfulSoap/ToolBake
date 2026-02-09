package auth

import "time"

type TwoFAInfoDto struct {
	Type      string    `json:"type"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
}

type TwoFAGetResponseDto struct {
	TwoFAList []TwoFAInfoDto `json:"two_fa_list"`
}
