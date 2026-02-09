package main

import (
	"context"
	"fmt"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/di"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/utils"

	"github.com/google/uuid"
	"github.com/pkg/errors"
)

func main() {
	migrator := NewMigratorCommand()
	if err := migrator.Run(); err != nil {
		panic(err)
	}
}

// MigratorCommand encapsulates all dependencies required to run database migrations.
type MigratorCommand struct {
	config    config.Config
	migration repository.IMigration
}

func NewMigratorCommand() *MigratorCommand {
	m := &MigratorCommand{}
	m.init()
	return m
}

func (m *MigratorCommand) init() {
	di.InitDI()

	if err := di.Container.Invoke(func(cfg config.Config, migration repository.IMigration) {
		m.config = cfg
		m.migration = migration
	}); err != nil {
		panic(errors.Errorf("failed to initialize migrate command dependencies: %v", err))
	}

	logger.InitLogger(m.config)
}

func (m *MigratorCommand) Run() error {
	ctx := initRequestContext()

	logger.Info(ctx, "starting database migration")
	if err := m.migration.RunMigrate(ctx); err != nil {
		return errors.Wrap(err, "migration failed")
	}

	logger.Info(ctx, "migration completed successfully")
	fmt.Println("migration completed successfully")
	return nil
}

func initRequestContext() context.Context {
	ctx := utils.NewValueContext(context.Background())
	ctx.Set("x-request-id", uuid.New().String())
	ctx.Set("request-start-time", time.Now())
	return ctx
}
