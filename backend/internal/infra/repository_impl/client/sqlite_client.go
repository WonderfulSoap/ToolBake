package client

import (
	"os"
	"path/filepath"
	"ya-tool-craft/internal/config"

	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
	_ "modernc.org/sqlite"
)

func NewSqliteClient(config config.Config) (*SqliteClient, error) {
	if config.SqlitePath == "" {
		return nil, errors.Errorf("invalid sqlite store path: %s", config.SqlitePath)
	}

	// support in-memory sqlite
	path := config.SqlitePath
	if path == "memory" {
		// https://github.com/mattn/go-sqlite3/issues/204
		// use shared cache to allow multiple connections to the same in-memory db, otherwise each connection will create new db
		path = "file::memory:?cache=shared"
	} else {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return nil, errors.Wrapf(err, "failed to create sqlite store path: %s", path)
		}
	}

	db, err := sqlx.Open("sqlite", path)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open sqlite: %s", path)
	}

	return &SqliteClient{
		db:     db,
		config: config,
	}, nil
}

type SqliteClient struct {
	db     *sqlx.DB
	config config.Config
}

func (c *SqliteClient) DB() *sqlx.DB {
	return c.db
}

func (c *SqliteClient) Close() error {
	return c.db.Close()
}
