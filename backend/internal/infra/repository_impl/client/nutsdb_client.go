package client

import (
	"os"
	"ya-tool-craft/internal/config"

	"github.com/nutsdb/nutsdb"
	"github.com/pkg/errors"
)

// NewNutsDBClient creates a new NutsDB database client
func NewNutsDBClient(config config.Config) (*NutsDBClient, error) {
	if config.NutsDBPath == "" {
		return nil, errors.Errorf("invalid nutsdb store path: %s", config.NutsDBPath)
	}

	path := config.NutsDBPath
	if err := os.MkdirAll(path, 0755); err != nil {
		return nil, errors.Wrapf(err, "failed to create nutsdb store path: %s", path)
	}

	db, err := nutsdb.Open(
		nutsdb.DefaultOptions,
		nutsdb.WithDir(path),
	)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to open nutsdb: %s", path)
	}

	return &NutsDBClient{DB: db}, nil
}

type NutsDBClient struct {
	DB *nutsdb.DB
}

func (c *NutsDBClient) Close() error {
	return c.DB.Close()
}
