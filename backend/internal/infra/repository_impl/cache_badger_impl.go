package repository_impl

import (
	"context"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/utils"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/pkg/errors"
)

func NewCacheBadgerImpl(config config.Config, client *client.BadgerClient) *CacheBadgerImpl {
	return &CacheBadgerImpl{
		config: config,
		client: client,
	}
}

type CacheBadgerImpl struct {
	config config.Config
	client *client.BadgerClient
}

// Set stores a key-value pair without expiration
func (c *CacheBadgerImpl) Set(ctx context.Context, key string, value string) error {
	err := c.client.DB.Update(func(txn *badger.Txn) error {
		return txn.Set([]byte(key), []byte(value))
	})

	if err != nil {
		return errors.Wrap(err, "fail to set cache value in badger")
	}

	return nil
}

// SetWithTTL stores a key-value pair with TTL (time to live in seconds)
func (c *CacheBadgerImpl) SetWithTTL(ctx context.Context, key string, value string, ttl uint64) error {
	ttlDuration := utils.TTLInSecondToTimeDuration(ttl)

	err := c.client.DB.Update(func(txn *badger.Txn) error {
		entry := badger.NewEntry([]byte(key), []byte(value)).WithTTL(ttlDuration)
		return txn.SetEntry(entry)
	})

	if err != nil {
		return errors.Wrap(err, "fail to set cache value with TTL in badger")
	}

	return nil
}

// Get retrieves a value by key
// Returns (value, true, nil) if key exists
// Returns ("", false, nil) if key does not exist
// Returns ("", false, error) if an error occurred
func (c *CacheBadgerImpl) Get(ctx context.Context, key string) (string, bool, error) {
	var value string

	err := c.client.DB.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(key))
		if err != nil {
			return err
		}

		return item.Value(func(val []byte) error {
			value = string(val)
			return nil
		})
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// key not found or expired
			return "", false, nil
		}
		return "", false, errors.Wrap(err, "fail to get cache value from badger")
	}

	return value, true, nil
}

// Delete removes a key-value pair
func (c *CacheBadgerImpl) Delete(ctx context.Context, key string) error {
	err := c.client.DB.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(key))
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// key already deleted or doesn't exist, not an error
			return nil
		}
		return errors.Wrap(err, "fail to delete cache value from badger")
	}

	return nil
}

// Has checks if a key exists
func (c *CacheBadgerImpl) Has(ctx context.Context, key string) (bool, error) {
	err := c.client.DB.View(func(txn *badger.Txn) error {
		_, err := txn.Get([]byte(key))
		return err
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// key not found or expired
			return false, nil
		}
		return false, errors.Wrap(err, "fail to check cache key existence in badger")
	}

	return true, nil
}
