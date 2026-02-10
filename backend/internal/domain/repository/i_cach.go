package repository

import (
	"context"
)

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_cache.go -package mock_gen ya-tool-craft/internal/domain/repository ICache
type ICache interface {
	Set(ctx context.Context, key string, value string) error
	SetWithTTL(ctx context.Context, key string, value string, ttl uint64) error
	Get(ctx context.Context, key string) (string, bool, error)
	Delete(ctx context.Context, key string) error
	Has(ctx context.Context, key string) (bool, error)
}
