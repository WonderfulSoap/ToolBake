package auth

type TwoFARecoveryRequestDto struct {
	Token        string `json:"token" binding:"required"`
	RecoveryCode string `json:"recovery_code" binding:"required"`
}
