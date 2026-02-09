package repository

import (
	"context"
)

type ICache interface {
	Set(ctx context.Context, key string, value string) error
	SetWithTTL(ctx context.Context, key string, value string, ttl uint64) error
	Get(ctx context.Context, key string) (string, bool, error)
	Delete(ctx context.Context, key string) error
	Has(ctx context.Context, key string) (bool, error)
}
