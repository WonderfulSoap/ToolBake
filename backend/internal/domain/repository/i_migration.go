package repository

import "context"

type IMigration interface {
	RunMigrate(ctx context.Context) error
}
