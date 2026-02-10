package repository

import "github.com/jmoiron/sqlx"

//go:generate mockgen -destination=../../infra/repository_impl/mock_gen/mock_i_rds_client.go -package mock_gen ya-tool-craft/internal/domain/repository IRdsClient
type IRdsClient interface {
	DB() *sqlx.DB
}
