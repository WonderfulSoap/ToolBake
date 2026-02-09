package repository_impl

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"

	"github.com/stretchr/testify/assert"
)

func TestCacheBadgerImpl_Set(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Test setting a value
		err := cache.Set(ctx, "test-key", "test-value")
		assert.Nil(t, err)

		// Verify the value can be retrieved
		value, exists, err := cache.Get(ctx, "test-key")
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, "test-value", value)
	})
}

func TestCacheBadgerImpl_SetWithTTL(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Test setting a value with TTL
		ttl := uint64(2) // 2 seconds
		err := cache.SetWithTTL(ctx, "ttl-key", "ttl-value", ttl)
		assert.Nil(t, err)

		// Verify the value exists immediately
		value, exists, err := cache.Get(ctx, "ttl-key")
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, "ttl-value", value)

		// Wait for TTL to expire
		time.Sleep(3 * time.Second)

		// Verify the value has expired
		value, exists, err = cache.Get(ctx, "ttl-key")
		assert.Nil(t, err)
		assert.False(t, exists)
		assert.Equal(t, "", value)
	})
}

func TestCacheBadgerImpl_Get(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Test getting an existing value
		err := cache.Set(ctx, "existing-key", "existing-value")
		assert.Nil(t, err)

		value, exists, err := cache.Get(ctx, "existing-key")
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, "existing-value", value)

		// Test getting a non-existing value
		value, exists, err = cache.Get(ctx, "non-existing-key")
		assert.Nil(t, err)
		assert.False(t, exists)
		assert.Equal(t, "", value)
	})
}

func TestCacheBadgerImpl_Delete(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Set a value
		err := cache.Set(ctx, "delete-key", "delete-value")
		assert.Nil(t, err)

		// Verify it exists
		exists, err := cache.Has(ctx, "delete-key")
		assert.Nil(t, err)
		assert.True(t, exists)

		// Delete the value
		err = cache.Delete(ctx, "delete-key")
		assert.Nil(t, err)

		// Verify it no longer exists
		exists, err = cache.Has(ctx, "delete-key")
		assert.Nil(t, err)
		assert.False(t, exists)

		// Test deleting a non-existing key (should not error - idempotent)
		err = cache.Delete(ctx, "non-existing-key")
		assert.Nil(t, err)
	})
}

func TestCacheBadgerImpl_Has(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Test checking an existing key
		err := cache.Set(ctx, "has-key", "has-value")
		assert.Nil(t, err)

		exists, err := cache.Has(ctx, "has-key")
		assert.Nil(t, err)
		assert.True(t, exists)

		// Test checking a non-existing key
		exists, err = cache.Has(ctx, "no-such-key")
		assert.Nil(t, err)
		assert.False(t, exists)
	})
}

func TestCacheBadgerImpl_MultipleKeys(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Set multiple keys
		keys := []string{"key1", "key2", "key3"}
		values := []string{"value1", "value2", "value3"}

		for i := range keys {
			err := cache.Set(ctx, keys[i], values[i])
			assert.Nil(t, err)
		}

		// Verify all keys exist
		for i := range keys {
			value, exists, err := cache.Get(ctx, keys[i])
			assert.Nil(t, err)
			assert.True(t, exists)
			assert.Equal(t, values[i], value)
		}

		// Delete one key
		err := cache.Delete(ctx, "key2")
		assert.Nil(t, err)

		// Verify key2 is deleted but others remain
		exists, err := cache.Has(ctx, "key1")
		assert.Nil(t, err)
		assert.True(t, exists)

		exists, err = cache.Has(ctx, "key2")
		assert.Nil(t, err)
		assert.False(t, exists)

		exists, err = cache.Has(ctx, "key3")
		assert.Nil(t, err)
		assert.True(t, exists)
	})
}

func TestCacheBadgerImpl_ConcurrentSet(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		cache := NewCacheBadgerImpl(unitTestCtx.Config, badgerClient)

		// Number of concurrent goroutines
		concurrency := 50
		keysPerGoroutine := 10

		// Channel to collect results
		type result struct {
			key   string
			value string
			err   error
		}
		resultChan := make(chan result, concurrency*keysPerGoroutine)

		// Use sync.Map to detect duplicates in real-time (thread-safe)
		var keyMap sync.Map

		// Use sync.WaitGroup to wait for all goroutines
		var wg sync.WaitGroup
		wg.Add(concurrency)

		// Launch multiple goroutines to set cache concurrently
		for i := range concurrency {
			go func(goroutineID int) {
				defer wg.Done()

				for j := range keysPerGoroutine {
					key := fmt.Sprintf("concurrent-key-%d-%d", goroutineID, j)
					value := fmt.Sprintf("concurrent-value-%d-%d", goroutineID, j)
					err := cache.Set(ctx, key, value)

					// Check for duplicates immediately using sync.Map
					if err == nil {
						if _, exists := keyMap.LoadOrStore(key, true); exists {
							t.Errorf("CRITICAL: Duplicate key detected in real-time! Key: %s", key)
						}
					}

					resultChan <- result{
						key:   key,
						value: value,
						err:   err,
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		wg.Wait()
		close(resultChan)

		// Collect and verify all results
		keys := make(map[string]string)
		errorCount := 0

		for res := range resultChan {
			if res.err != nil {
				errorCount++
				t.Errorf("Error setting cache: %v", res.err)
				continue
			}

			keys[res.key] = res.value
		}

		// Verify no errors occurred
		assert.Equal(t, 0, errorCount, "No errors should occur during concurrent cache set")

		// Verify all keys are unique
		expectedKeyCount := concurrency * keysPerGoroutine
		assert.Equal(t, expectedKeyCount, len(keys),
			"All %d keys should be unique, but got %d unique keys",
			expectedKeyCount, len(keys))

		// Verify all keys can be retrieved with correct values
		for key, expectedValue := range keys {
			value, exists, err := cache.Get(ctx, key)
			assert.Nil(t, err)
			assert.True(t, exists, "Key %s should exist", key)
			assert.Equal(t, expectedValue, value, "Value for key %s should match", key)
		}

		t.Logf("✅ Successfully set %d unique keys concurrently with NO duplicates", len(keys))
	})
}
