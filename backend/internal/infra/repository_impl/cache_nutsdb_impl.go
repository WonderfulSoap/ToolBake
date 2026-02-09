package repository_impl

import (
	"context"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/infra/repository_impl/client"

	"github.com/nutsdb/nutsdb"
	"github.com/pkg/errors"
)

const nutsdbCacheBucket = "cache"

func NewCacheNutsDBImpl(config config.Config, client *client.NutsDBClient) *CacheNutsDBImpl {
	// ensure bucket exists
	if err := client.DB.Update(func(tx *nutsdb.Tx) error {
		if !tx.ExistBucket(nutsdb.DataStructureBTree, nutsdbCacheBucket) {
			return tx.NewBucket(nutsdb.DataStructureBTree, nutsdbCacheBucket)
		}
		return nil
	}); err != nil {
		panic(errors.Wrap(err, "failed to create nutsdb cache bucket"))
	}

	return &CacheNutsDBImpl{
		config: config,
		client: client,
	}
}

type CacheNutsDBImpl struct {
	config config.Config
	client *client.NutsDBClient
}

// Set stores a key-value pair without expiration
func (c *CacheNutsDBImpl) Set(ctx context.Context, key string, value string) error {
	err := c.client.DB.Update(func(tx *nutsdb.Tx) error {
		return tx.Put(nutsdbCacheBucket, []byte(key), []byte(value), nutsdb.Persistent)
	})
	if err != nil {
		return errors.Wrap(err, "fail to set cache value in nutsdb")
	}
	return nil
}

// SetWithTTL stores a key-value pair with TTL (time to live in seconds)
func (c *CacheNutsDBImpl) SetWithTTL(ctx context.Context, key string, value string, ttl uint64) error {
	err := c.client.DB.Update(func(tx *nutsdb.Tx) error {
		return tx.Put(nutsdbCacheBucket, []byte(key), []byte(value), uint32(ttl))
	})
	if err != nil {
		return errors.Wrap(err, "fail to set cache value with TTL in nutsdb")
	}
	return nil
}

// Get retrieves a value by key
// Returns (value, true, nil) if key exists
// Returns ("", false, nil) if key does not exist
// Returns ("", false, error) if an error occurred
func (c *CacheNutsDBImpl) Get(ctx context.Context, key string) (string, bool, error) {
	var value string

	err := c.client.DB.View(func(tx *nutsdb.Tx) error {
		val, err := tx.Get(nutsdbCacheBucket, []byte(key))
		if err != nil {
			return err
		}
		value = string(val)
		return nil
	})

	if err != nil {
		if nutsdb.IsKeyNotFound(err) || nutsdb.IsBucketNotFound(err) {
			return "", false, nil
		}
		return "", false, errors.Wrap(err, "fail to get cache value from nutsdb")
	}

	return value, true, nil
}

// Delete removes a key-value pair
func (c *CacheNutsDBImpl) Delete(ctx context.Context, key string) error {
	err := c.client.DB.Update(func(tx *nutsdb.Tx) error {
		return tx.Delete(nutsdbCacheBucket, []byte(key))
	})
	if err != nil {
		if nutsdb.IsKeyNotFound(err) || nutsdb.IsBucketNotFound(err) {
			return nil
		}
		return errors.Wrap(err, "fail to delete cache value from nutsdb")
	}
	return nil
}

// Has checks if a key exists
func (c *CacheNutsDBImpl) Has(ctx context.Context, key string) (bool, error) {
	err := c.client.DB.View(func(tx *nutsdb.Tx) error {
		_, err := tx.Get(nutsdbCacheBucket, []byte(key))
		return err
	})
	if err != nil {
		if nutsdb.IsKeyNotFound(err) || nutsdb.IsBucketNotFound(err) {
			return false, nil
		}
		return false, errors.Wrap(err, "fail to check cache key existence in nutsdb")
	}
	return true, nil
}
