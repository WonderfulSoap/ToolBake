package repository_impl

import (
	"context"
	"testing"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"

	"github.com/stretchr/testify/assert"
)

func TestGlobalScriptRepositoryRdsImpl_GetGlobalScript_NotFound(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		result, err := repo.GetGlobalScript(entity.UserIDEntity("non-existent-user"))
		assert.Nil(t, err)
		assert.Nil(t, result)
	})
}

func TestGlobalScriptRepositoryRdsImpl_UpdateGlobalScript(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		userID := entity.UserIDEntity("test-user-1")
		script := "console.log('hello world')"

		// Insert a new global script
		err := repo.UpdateGlobalScript(userID, script)
		assert.Nil(t, err)

		// Verify it was created
		result, err := repo.GetGlobalScript(userID)
		assert.Nil(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, script, result.Script)
		assert.True(t, time.Since(result.UpdatedAt) < 5*time.Second)
	})
}

func TestGlobalScriptRepositoryRdsImpl_UpdateGlobalScript_Upsert(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		userID := entity.UserIDEntity("test-user-1")

		// Insert initial script
		err := repo.UpdateGlobalScript(userID, "initial script")
		assert.Nil(t, err)

		beforeUpdate := time.Now()

		// Update to a new script (upsert)
		updatedScript := "updated script content"
		err = repo.UpdateGlobalScript(userID, updatedScript)
		assert.Nil(t, err)

		// Verify the script was updated, not duplicated
		result, err := repo.GetGlobalScript(userID)
		assert.Nil(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, updatedScript, result.Script)
		assert.True(t, result.UpdatedAt.After(beforeUpdate) || result.UpdatedAt.Equal(beforeUpdate))
	})
}

func TestGlobalScriptRepositoryRdsImpl_UpdateGlobalScript_EmptyScript(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		userID := entity.UserIDEntity("test-user-1")

		// Insert an empty script
		err := repo.UpdateGlobalScript(userID, "")
		assert.Nil(t, err)

		result, err := repo.GetGlobalScript(userID)
		assert.Nil(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "", result.Script)
	})
}

func TestGlobalScriptRepositoryRdsImpl_DifferentUsers(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		userID1 := entity.UserIDEntity("user-1")
		userID2 := entity.UserIDEntity("user-2")

		// Each user sets their own script
		err := repo.UpdateGlobalScript(userID1, "user1 script")
		assert.Nil(t, err)
		err = repo.UpdateGlobalScript(userID2, "user2 script")
		assert.Nil(t, err)

		// Verify scripts are independent per user
		result1, err := repo.GetGlobalScript(userID1)
		assert.Nil(t, err)
		assert.NotNil(t, result1)
		assert.Equal(t, "user1 script", result1.Script)

		result2, err := repo.GetGlobalScript(userID2)
		assert.Nil(t, err)
		assert.NotNil(t, result2)
		assert.Equal(t, "user2 script", result2.Script)
	})
}

func TestGlobalScriptRepositoryRdsImpl_UpdateGlobalScript_UpdatedAtChanges(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		repo := NewGlobalScriptRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		userID := entity.UserIDEntity("test-user-1")

		// Insert initial script
		err := repo.UpdateGlobalScript(userID, "script v1")
		assert.Nil(t, err)

		first, err := repo.GetGlobalScript(userID)
		assert.Nil(t, err)
		firstUpdatedAt := first.UpdatedAt

		// Wait a bit to ensure time difference
		time.Sleep(10 * time.Millisecond)

		// Update script
		err = repo.UpdateGlobalScript(userID, "script v2")
		assert.Nil(t, err)

		second, err := repo.GetGlobalScript(userID)
		assert.Nil(t, err)
		assert.True(t, second.UpdatedAt.After(firstUpdatedAt))
	})
}
