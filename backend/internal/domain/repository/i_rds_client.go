package repository

import "github.com/jmoiron/sqlx"

type IRdsClient interface {
	DB() *sqlx.DB
}
