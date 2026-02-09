package client

import (
	"os"
	"ya-tool-craft/internal/config"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/pkg/errors"
)

// NewBadgerClient creates a new Badger database client
// It supports both file-based and in-memory modes
// For in-memory mode, set config.BadgerPath to "memory"
func NewBadgerClient(config config.Config) (*BadgerClient, error) {
	if config.BadgerPath == "" {
		return nil, errors.Errorf("invalid badger store path: %s", config.BadgerPath)
	}

	var db *badger.DB
	var err error

	// support in-memory badger
	path := config.BadgerPath
	if path == "memory" {
		// Create in-memory Badger database
		opt := badger.DefaultOptions("").WithInMemory(true)
		db, err = badger.Open(opt)
	} else {
		// Create file-based Badger database
		if err := os.MkdirAll(path, 0755); err != nil {
			return nil, errors.Wrapf(err, "failed to create badger store path: %s", path)
		}

		opt := badger.DefaultOptions(path).
			WithDir(path).
			WithValueDir(path)
		db, err = badger.Open(opt)
	}

	if err != nil {
		return nil, errors.Wrapf(err, "failed to open badger: %s", path)
	}

	return &BadgerClient{DB: db}, nil
}

type BadgerClient struct {
	DB *badger.DB
}

func (c *BadgerClient) Close() error {
	return c.DB.Close()
}
