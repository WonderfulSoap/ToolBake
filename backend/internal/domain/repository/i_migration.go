package repository

import "context"

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_migration.go -package mock_gen ya-tool-craft/internal/domain/repository IMigration
type IMigration interface {
	RunMigrate(ctx context.Context) error
}
