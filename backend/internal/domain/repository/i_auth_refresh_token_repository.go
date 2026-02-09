package repository

import (
	"context"
	"ya-tool-craft/internal/domain/entity"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_auth_refresh_token_repository.go -package mock_gen ya-tool-craft/internal/domain/repository IAuthRefreshTokenRepository
type IAuthRefreshTokenRepository interface {
	IssueRefreshToken(ctx context.Context, userID entity.UserIDEntity) (entity.RefreshToken, error)
	ValidateRefreshToken(ctx context.Context, token string) (entity.RefreshToken, bool, error)
	ValidateRefreshTokenHash(ctx context.Context, tokenHash string) (entity.RefreshToken, bool, error)
	DeleteRefreshToken(ctx context.Context, token string) error
	DeleteRefreshTokenByHash(ctx context.Context, tokenHash string) error
	DeleteAllTokensByUserID(ctx context.Context, userID entity.UserIDEntity) error
}
