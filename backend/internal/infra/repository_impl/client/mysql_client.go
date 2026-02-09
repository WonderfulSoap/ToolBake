package client

import (
	"fmt"
	"ya-tool-craft/internal/config"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"
)

func NewMysqlClient(config config.Config) (*MysqlClient, error) {
	if config.MysqlHost == "" || config.MysqlUser == "" || config.MysqlDB == "" {
		return nil, errors.Errorf("invalid mysql config: host=%s user=%s db=%s", config.MysqlHost, config.MysqlUser, config.MysqlDB)
	}

	port := config.MysqlPort
	if port == "" {
		port = "3306"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&multiStatements=true",
		config.MysqlUser,
		config.MysqlPass,
		config.MysqlHost,
		port,
		config.MysqlDB,
	)

	db, err := sqlx.Open("mysql", dsn)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open mysql: %s:%s/%s", config.MysqlHost, port, config.MysqlDB)
	}

	if err := db.Ping(); err != nil {
		return nil, errors.Wrapf(err, "failed to ping mysql: %s:%s/%s", config.MysqlHost, port, config.MysqlDB)
	}

	return &MysqlClient{
		db:     db,
		config: config,
	}, nil
}

type MysqlClient struct {
	db     *sqlx.DB
	config config.Config
}

func (c *MysqlClient) DB() *sqlx.DB {
	return c.db
}

func (c *MysqlClient) Close() error {
	return c.db.Close()
}
