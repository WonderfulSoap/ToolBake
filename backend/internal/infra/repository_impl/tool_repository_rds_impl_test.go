package repository_impl

import (
	"context"
	"fmt"
	"testing"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"

	"github.com/stretchr/testify/assert"
)

func newTestToolMeta(tag string) (string, map[string]string, string) {
	return fmt.Sprintf("%s description", tag), map[string]string{"tag": tag}, fmt.Sprintf("%s-category", tag)
}

func TestToolRepositoryRdsImpl_CreateTool(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Test basic tool creation
		userID := entity.UserIDEntity(user.ID)
		description, extraInfo, category := newTestToolMeta("create")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Test Tool",
			"test-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"source code here",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)

		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)

		// Verify tool was created
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(allTools.Tools))
		assert.Equal(t, tool.Name, allTools.Tools[0].Name)
		assert.Equal(t, tool.Namespace, allTools.Tools[0].Namespace)
		assert.Equal(t, tool.IsActivate, allTools.Tools[0].IsActivate)
		assert.Equal(t, tool.RealtimeExecution, allTools.Tools[0].RealtimeExecution)
		assert.Equal(t, tool.UiWidgets, allTools.Tools[0].UiWidgets)
		assert.Equal(t, tool.Source, allTools.Tools[0].Source)
		assert.Equal(t, description, allTools.Tools[0].Description)
		assert.Equal(t, category, allTools.Tools[0].Category)
		assert.Equal(t, extraInfo, allTools.Tools[0].ExtraInfo)
	})
}

func TestToolRepositoryRdsImpl_CreateTool_MultipleTools(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create multiple tools
		for i := 0; i < 3; i++ {
			description, extraInfo, category := newTestToolMeta(fmt.Sprintf("multi-%d", i))
			tool := entity.NewToolEntityWithoutUID(
				"tool-"+string(rune(i)),
				"Test Tool "+string(rune(i)),
				"test-namespace",
				category,
				true,
				false,
				`[{"type": "text"}]`,
				"source code here",
				description,
				extraInfo,
				time.Now(),
				time.Now(),
			)
			err = toolRdsImpl.CreateTool(userID, tool)
			assert.Nil(t, err)
		}

		// Verify all tools were created
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 3, len(allTools.Tools))
	})
}

func TestToolRepositoryRdsImpl_UpdateTool(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create a test tool
		description, extraInfo, category := newTestToolMeta("update-original")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Original Name",
			"original-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"original source",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)
		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)

		// Get the created tool
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(allTools.Tools))
		createdTool := allTools.Tools[0]

		// Record original CreatedAt and UpdatedAt
		originalCreatedAt := createdTool.CreatedAt
		originalUpdatedAt := createdTool.UpdatedAt

		beforeUpdate := time.Now()

		updatedDescription, updatedExtraInfo, updatedCategory := newTestToolMeta("update-updated")
		createdTool.Description = updatedDescription
		createdTool.ExtraInfo = updatedExtraInfo
		createdTool.Category = updatedCategory

		// Update tool
		createdTool.Name = "Updated Name"
		createdTool.Namespace = "updated-namespace"
		createdTool.IsActivate = false
		createdTool.RealtimeExecution = true
		createdTool.UiWidgets = `[{"type": "number"}]`
		createdTool.Source = "updated source"

		err = toolRdsImpl.UpdateTool(userID, createdTool)
		assert.Nil(t, err)

		afterUpdate := time.Now()

		// Verify updates
		updatedTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(updatedTools.Tools))
		updatedTool := updatedTools.Tools[0]

		// Verify content updates
		assert.Equal(t, "Updated Name", updatedTool.Name)
		assert.Equal(t, "updated-namespace", updatedTool.Namespace)
		assert.Equal(t, false, updatedTool.IsActivate)
		assert.Equal(t, true, updatedTool.RealtimeExecution)
		assert.Equal(t, `[{"type": "number"}]`, updatedTool.UiWidgets)
		assert.Equal(t, "updated source", updatedTool.Source)
		assert.Equal(t, updatedDescription, updatedTool.Description)
		assert.Equal(t, updatedCategory, updatedTool.Category)
		assert.Equal(t, updatedExtraInfo, updatedTool.ExtraInfo)

		// Verify CreatedAt has not changed
		assert.Equal(t, originalCreatedAt, updatedTool.CreatedAt)

		// Verify UpdatedAt was changed and is after the original UpdatedAt
		assert.True(t, updatedTool.UpdatedAt.After(originalUpdatedAt))
		assert.True(t, updatedTool.UpdatedAt.After(beforeUpdate) || updatedTool.UpdatedAt.Equal(beforeUpdate))
		assert.True(t, updatedTool.UpdatedAt.Before(afterUpdate) || updatedTool.UpdatedAt.Equal(afterUpdate))
	})
}

func TestToolRepositoryRdsImpl_DeleteTool(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create a test tool
		description, extraInfo, category := newTestToolMeta("delete")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Test Tool",
			"test-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"source code",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)
		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)

		// Verify tool exists
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(allTools.Tools))
		toolUID := allTools.Tools[0].UniqueID

		// Delete tool
		err = toolRdsImpl.DeleteTool(user.ID, toolUID)
		assert.Nil(t, err)

		// Verify tool is deleted
		allTools, err = toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 0, len(allTools.Tools))
	})
}

func TestToolRepositoryRdsImpl_DeleteTool_SpecificToolOnly(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create multiple tools
		description1, extraInfo1, category1 := newTestToolMeta("delete-specific-1")
		tool1 := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Tool 1",
			"namespace-1",
			category1,
			true,
			false,
			`[{"type": "text"}]`,
			"source 1",
			description1,
			extraInfo1,
			time.Now(),
			time.Now(),
		)
		description2, extraInfo2, category2 := newTestToolMeta("delete-specific-2")
		tool2 := entity.NewToolEntityWithoutUID(
			"tool-2",
			"Tool 2",
			"namespace-2",
			category2,
			true,
			false,
			`[{"type": "text"}]`,
			"source 2",
			description2,
			extraInfo2,
			time.Now(),
			time.Now(),
		)

		err = toolRdsImpl.CreateTool(userID, tool1)
		assert.Nil(t, err)
		err = toolRdsImpl.CreateTool(userID, tool2)
		assert.Nil(t, err)

		// Verify both tools exist
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 2, len(allTools.Tools))

		// Delete first tool
		toolUID1 := allTools.Tools[0].UniqueID
		err = toolRdsImpl.DeleteTool(userID, toolUID1)
		assert.Nil(t, err)

		// Verify only second tool remains
		allTools, err = toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(allTools.Tools))
		assert.NotEqual(t, toolUID1, allTools.Tools[0].UniqueID)
	})
}

func TestToolRepositoryRdsImpl_AllTools(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create test users
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user1, err := userRdsImpl.Create(ctx, "user1", roles)
		assert.Nil(t, err)
		user2, err := userRdsImpl.Create(ctx, "user2", roles)
		assert.Nil(t, err)

		userID1 := entity.UserIDEntity(user1.ID)
		userID2 := entity.UserIDEntity(user2.ID)

		// Create tools for user1
		description1, extraInfo1, category1 := newTestToolMeta("alltools-user1-1")
		tool1 := entity.NewToolEntityWithoutUID(
			"tool-1",
			"User1 Tool 1",
			"namespace-1",
			category1,
			true,
			false,
			`[{"type": "text"}]`,
			"source 1",
			description1,
			extraInfo1,
			time.Now(),
			time.Now(),
		)
		description2, extraInfo2, category2 := newTestToolMeta("alltools-user1-2")
		tool2 := entity.NewToolEntityWithoutUID(
			"tool-2",
			"User1 Tool 2",
			"namespace-2",
			category2,
			true,
			false,
			`[{"type": "text"}]`,
			"source 2",
			description2,
			extraInfo2,
			time.Now(),
			time.Now(),
		)

		err = toolRdsImpl.CreateTool(userID1, tool1)
		assert.Nil(t, err)
		err = toolRdsImpl.CreateTool(userID1, tool2)
		assert.Nil(t, err)

		// Create tool for user2
		description3, extraInfo3, category3 := newTestToolMeta("alltools-user2-1")
		tool3 := entity.NewToolEntityWithoutUID(
			"tool-3",
			"User2 Tool 1",
			"namespace-3",
			category3,
			true,
			false,
			`[{"type": "text"}]`,
			"source 3",
			description3,
			extraInfo3,
			time.Now(),
			time.Now(),
		)

		err = toolRdsImpl.CreateTool(userID2, tool3)
		assert.Nil(t, err)

		// Test getting all tools for user1
		user1Tools, err := toolRdsImpl.AllTools(userID1)
		assert.Nil(t, err)
		assert.Equal(t, 2, len(user1Tools.Tools))
		assert.Equal(t, "User1 Tool 1", user1Tools.Tools[0].Name)
		assert.Equal(t, "User1 Tool 2", user1Tools.Tools[1].Name)

		// Test getting all tools for user2
		user2Tools, err := toolRdsImpl.AllTools(userID2)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(user2Tools.Tools))
		assert.Equal(t, "User2 Tool 1", user2Tools.Tools[0].Name)
	})
}

func TestToolRepositoryRdsImpl_AllTools_Empty(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user without tools
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Get all tools (should be empty)
		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		assert.Equal(t, 0, len(allTools.Tools))
	})
}

func TestToolRepositoryRdsImpl_ToolsLastUpdatedAt(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Before creating any tool, last updated should be nil
		lastUpdated, err := toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)
		assert.Nil(t, lastUpdated)

		// Create a tool
		beforeCreation := time.Now()
		description, extraInfo, category := newTestToolMeta("tools-last-updated")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Test Tool",
			"test-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"source code",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)
		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)
		afterCreation := time.Now()

		// Verify last updated time is set
		lastUpdated, err = toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)
		assert.NotNil(t, lastUpdated)
		assert.True(t, lastUpdated.After(beforeCreation) || lastUpdated.Equal(beforeCreation))
		assert.True(t, lastUpdated.Before(afterCreation) || lastUpdated.Equal(afterCreation))
	})
}

func TestToolRepositoryRdsImpl_ToolsLastUpdatedAt_UpdatedOnModification(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create a tool
		description, extraInfo, category := newTestToolMeta("tools-last-updated-update")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Test Tool",
			"test-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"source code",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)
		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)

		// Get initial last updated time
		firstUpdated, err := toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)

		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		updatedTool := allTools.Tools[0]
		updatedTool.Name = "Updated Tool"
		updatedDescription, updatedExtraInfo, updatedCategory := newTestToolMeta("tools-last-updated-update-updated")
		updatedTool.Description = updatedDescription
		updatedTool.ExtraInfo = updatedExtraInfo

		updatedTool.Description = updatedDescription
		updatedTool.ExtraInfo = updatedExtraInfo
		updatedTool.Category = updatedCategory

		err = toolRdsImpl.UpdateTool(userID, updatedTool)
		assert.Nil(t, err)

		// Get new last updated time
		secondUpdated, err := toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)

		// Verify last updated time was updated
		assert.NotNil(t, firstUpdated)
		assert.NotNil(t, secondUpdated)
		assert.True(t, secondUpdated.After(*firstUpdated))
	})
}

func TestToolRepositoryRdsImpl_ToolsLastUpdatedAt_UpdatedOnDeletion(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		userID := entity.UserIDEntity(user.ID)

		// Create a tool
		description, extraInfo, category := newTestToolMeta("tools-last-updated-delete")
		tool := entity.NewToolEntityWithoutUID(
			"tool-1",
			"Test Tool",
			"test-namespace",
			category,
			true,
			false,
			`[{"type": "text"}]`,
			"source code",
			description,
			extraInfo,
			time.Now(),
			time.Now(),
		)
		err = toolRdsImpl.CreateTool(userID, tool)
		assert.Nil(t, err)

		// Get initial last updated time
		firstUpdated, err := toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)

		allTools, err := toolRdsImpl.AllTools(userID)
		assert.Nil(t, err)
		toolUID := allTools.Tools[0].UniqueID

		err = toolRdsImpl.DeleteTool(userID, toolUID)
		assert.Nil(t, err)

		// Get new last updated time
		secondUpdated, err := toolRdsImpl.ToolsLastUpdatedAt(userID)
		assert.Nil(t, err)

		// Verify last updated time was updated
		assert.NotNil(t, firstUpdated)
		assert.NotNil(t, secondUpdated)
		assert.True(t, secondUpdated.After(*firstUpdated))
	})
}

// TestToolRepositoryRdsImpl_CreateTool_Concurrent tests concurrent tool creation across multiple users
func TestToolRepositoryRdsImpl_CreateTool_Concurrent(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create multiple test users (sequential, before concurrent operations)
		numUsers := 5
		numToolsPerUser := 10
		users := make([]entity.UserEntity, numUsers)

		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		for i := 0; i < numUsers; i++ {
			user, err := userRdsImpl.Create(ctx, "user"+string(rune(i)), roles)
			assert.Nil(t, err)
			users[i] = user
		}

		// Create tools concurrently
		done := make(chan bool, numUsers)
		errChan := make(chan error, numUsers*numToolsPerUser)

		for i := 0; i < numUsers; i++ {
			go func(userIdx int) {
				defer func() { done <- true }()
				user := users[userIdx]
				userID := entity.UserIDEntity(user.ID)

				// Each user creates multiple tools
				for j := 0; j < numToolsPerUser; j++ {
					description, extraInfo, category := newTestToolMeta(fmt.Sprintf("concurrent-create-%d-%d", userIdx, j))
					tool := entity.NewToolEntityWithoutUID(
						"tool-"+string(rune(userIdx))+"-"+string(rune(j)),
						"Tool "+string(rune(userIdx))+"-"+string(rune(j)),
						"namespace-"+string(rune(userIdx)),
						category,
						true,
						false,
						`[{"type": "text"}]`,
						"source "+string(rune(userIdx))+"-"+string(rune(j)),
						description,
						extraInfo,
						time.Now(),
						time.Now(),
					)

					err := toolRdsImpl.CreateTool(userID, tool)
					if err != nil {
						errChan <- err
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numUsers; i++ {
			<-done
		}

		// Check for any errors from concurrent operations
		close(errChan)
		for err := range errChan {
			assert.Nil(t, err)
		}

		// Verify all tools were created correctly
		for i := 0; i < numUsers; i++ {
			user := users[i]
			userID := entity.UserIDEntity(user.ID)
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			assert.Equal(t, numToolsPerUser, len(allTools.Tools))
		}
	})
}

// TestToolRepositoryRdsImpl_UpdateTool_Concurrent tests concurrent tool updates across multiple users
func TestToolRepositoryRdsImpl_UpdateTool_Concurrent(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create multiple test users and tools
		numUsers := 5
		numToolsPerUser := 5
		users := make([]entity.UserEntity, numUsers)
		userTools := make([][]entity.ToolEntity, numUsers)

		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		for i := 0; i < numUsers; i++ {
			user, err := userRdsImpl.Create(ctx, "user"+string(rune(i)), roles)
			assert.Nil(t, err)
			users[i] = user

			userID := entity.UserIDEntity(user.ID)
			userTools[i] = make([]entity.ToolEntity, numToolsPerUser)

			// Create tools for this user
			for j := 0; j < numToolsPerUser; j++ {
				description, extraInfo, category := newTestToolMeta(fmt.Sprintf("concurrent-update-%d-%d", i, j))
				tool := entity.NewToolEntityWithoutUID(
					"tool-"+string(rune(i))+"-"+string(rune(j)),
					"Tool "+string(rune(i))+"-"+string(rune(j)),
					"namespace-"+string(rune(i)),
					category,
					true,
					false,
					`[{"type": "text"}]`,
					"source "+string(rune(i))+"-"+string(rune(j)),
					description,
					extraInfo,
					time.Now(),
					time.Now(),
				)

				err = toolRdsImpl.CreateTool(userID, tool)
				assert.Nil(t, err)
			}

			// Retrieve created tools
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			userTools[i] = allTools.Tools
		}

		// Update tools concurrently
		done := make(chan bool, numUsers)
		errChan := make(chan error, numUsers*numToolsPerUser)

		for i := 0; i < numUsers; i++ {
			go func(userIdx int) {
				defer func() { done <- true }()
				user := users[userIdx]
				userID := entity.UserIDEntity(user.ID)

				// Update each tool
				for j := 0; j < len(userTools[userIdx]); j++ {
					tool := userTools[userIdx][j]
					tool.Name = "Updated-" + string(rune(userIdx)) + "-" + string(rune(j))
					tool.IsActivate = !tool.IsActivate
					tool.Source = "updated source " + string(rune(userIdx)) + "-" + string(rune(j))

					err := toolRdsImpl.UpdateTool(userID, tool)
					if err != nil {
						errChan <- err
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numUsers; i++ {
			<-done
		}

		// Check for any errors from concurrent operations
		close(errChan)
		for err := range errChan {
			assert.Nil(t, err)
		}

		// Verify all tools were updated correctly
		for i := 0; i < numUsers; i++ {
			user := users[i]
			userID := entity.UserIDEntity(user.ID)
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			assert.Equal(t, numToolsPerUser, len(allTools.Tools))

			// Verify names were updated
			for j := 0; j < len(allTools.Tools); j++ {
				assert.True(t, len(allTools.Tools[j].Name) > 0)
				assert.Contains(t, allTools.Tools[j].Name, "Updated-")
				assert.Contains(t, allTools.Tools[j].Source, "updated source")
			}
		}
	})
}

// TestToolRepositoryRdsImpl_DeleteTool_Concurrent tests concurrent tool deletions across multiple users
func TestToolRepositoryRdsImpl_DeleteTool_Concurrent(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create multiple test users and tools
		numUsers := 5
		numToolsPerUser := 10
		users := make([]entity.UserEntity, numUsers)
		userToolIDs := make([][]string, numUsers)

		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		for i := 0; i < numUsers; i++ {
			user, err := userRdsImpl.Create(ctx, "user"+string(rune(i)), roles)
			assert.Nil(t, err)
			users[i] = user

			userID := entity.UserIDEntity(user.ID)
			userToolIDs[i] = make([]string, numToolsPerUser)

			// Create tools for this user
			for j := 0; j < numToolsPerUser; j++ {
				description, extraInfo, category := newTestToolMeta(fmt.Sprintf("concurrent-delete-%d-%d", i, j))
				tool := entity.NewToolEntityWithoutUID(
					"tool-"+string(rune(i))+"-"+string(rune(j)),
					"Tool "+string(rune(i))+"-"+string(rune(j)),
					"namespace-"+string(rune(i)),
					category,
					true,
					false,
					`[{"type": "text"}]`,
					"source "+string(rune(i))+"-"+string(rune(j)),
					description,
					extraInfo,
					time.Now(),
					time.Now(),
				)

				err = toolRdsImpl.CreateTool(userID, tool)
				assert.Nil(t, err)
			}

			// Retrieve tool IDs
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			for j := 0; j < len(allTools.Tools); j++ {
				userToolIDs[i][j] = allTools.Tools[j].UniqueID
			}
		}

		// Verify all tools were created
		for i := 0; i < numUsers; i++ {
			user := users[i]
			userID := entity.UserIDEntity(user.ID)
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			assert.Equal(t, numToolsPerUser, len(allTools.Tools))
		}

		// Delete tools concurrently
		done := make(chan bool, numUsers)
		errChan := make(chan error, numUsers*numToolsPerUser)

		for i := 0; i < numUsers; i++ {
			go func(userIdx int) {
				defer func() { done <- true }()
				user := users[userIdx]
				userID := entity.UserIDEntity(user.ID)

				// Delete each tool
				for j := 0; j < len(userToolIDs[userIdx]); j++ {
					toolID := userToolIDs[userIdx][j]
					err := toolRdsImpl.DeleteTool(userID, toolID)
					if err != nil {
						errChan <- err
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numUsers; i++ {
			<-done
		}

		// Check for any errors from concurrent operations
		close(errChan)
		for err := range errChan {
			assert.Nil(t, err)
		}

		// Verify all tools were deleted correctly
		for i := 0; i < numUsers; i++ {
			user := users[i]
			userID := entity.UserIDEntity(user.ID)
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			assert.Equal(t, 0, len(allTools.Tools))
		}
	})
}

// TestToolRepositoryRdsImpl_MixedOperations_Concurrent tests concurrent mixed operations (create, update, delete) across multiple users
func TestToolRepositoryRdsImpl_MixedOperations_Concurrent(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)
		toolRdsImpl := NewToolRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create multiple test users
		numUsers := 3
		users := make([]entity.UserEntity, numUsers)

		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		for i := 0; i < numUsers; i++ {
			user, err := userRdsImpl.Create(ctx, "user"+string(rune(i)), roles)
			assert.Nil(t, err)
			users[i] = user
		}

		// Perform mixed operations concurrently
		done := make(chan bool, numUsers)
		errChan := make(chan error, numUsers*20) // Rough estimate of concurrent operations

		for i := 0; i < numUsers; i++ {
			go func(userIdx int) {
				defer func() { done <- true }()
				user := users[userIdx]
				userID := entity.UserIDEntity(user.ID)

				// Create initial tools
				for j := 0; j < 5; j++ {
					description, extraInfo, category := newTestToolMeta(fmt.Sprintf("mixed-create-initial-%d-%d", userIdx, j))
					tool := entity.NewToolEntityWithoutUID(
						"tool-"+string(rune(userIdx))+"-"+string(rune(j)),
						"Tool "+string(rune(userIdx))+"-"+string(rune(j)),
						"namespace-"+string(rune(userIdx)),
						category,
						true,
						false,
						`[{"type": "text"}]`,
						"source "+string(rune(userIdx))+"-"+string(rune(j)),
						description,
						extraInfo,
						time.Now(),
						time.Now(),
					)

					err := toolRdsImpl.CreateTool(userID, tool)
					if err != nil {
						errChan <- err
					}
				}

				// Update some tools
				allTools, err := toolRdsImpl.AllTools(userID)
				if err != nil {
					errChan <- err
				} else if len(allTools.Tools) > 0 {
					tool := allTools.Tools[0]
					tool.Name = "Updated-" + string(rune(userIdx))
					err = toolRdsImpl.UpdateTool(userID, tool)
					if err != nil {
						errChan <- err
					}
				}

				// Create more tools
				for j := 5; j < 8; j++ {
					description, extraInfo, category := newTestToolMeta(fmt.Sprintf("mixed-create-more-%d-%d", userIdx, j))
					tool := entity.NewToolEntityWithoutUID(
						"tool-"+string(rune(userIdx))+"-"+string(rune(j)),
						"Tool "+string(rune(userIdx))+"-"+string(rune(j)),
						"namespace-"+string(rune(userIdx)),
						category,
						true,
						false,
						`[{"type": "text"}]`,
						"source "+string(rune(userIdx))+"-"+string(rune(j)),
						description,
						extraInfo,
						time.Now(),
						time.Now(),
					)

					err := toolRdsImpl.CreateTool(userID, tool)
					if err != nil {
						errChan <- err
					}
				}

				// Delete some tools
				allTools, err = toolRdsImpl.AllTools(userID)
				if err != nil {
					errChan <- err
				} else if len(allTools.Tools) > 2 {
					// Delete the first 2 tools
					err = toolRdsImpl.DeleteTool(userID, allTools.Tools[0].UniqueID)
					if err != nil {
						errChan <- err
					}
					err = toolRdsImpl.DeleteTool(userID, allTools.Tools[1].UniqueID)
					if err != nil {
						errChan <- err
					}
				}
			}(i)
		}

		// Wait for all goroutines to complete
		for i := 0; i < numUsers; i++ {
			<-done
		}

		// Check for any errors from concurrent operations
		close(errChan)
		for err := range errChan {
			assert.Nil(t, err)
		}

		// Verify operations completed successfully
		for i := 0; i < numUsers; i++ {
			user := users[i]
			userID := entity.UserIDEntity(user.ID)
			allTools, err := toolRdsImpl.AllTools(userID)
			assert.Nil(t, err)
			// After creating 8 tools and deleting 2, should have 6 tools
			assert.Equal(t, 6, len(allTools.Tools))
		}
	})
}
