package repository_impl

import (
	"context"
	"testing"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"

	"github.com/stretchr/testify/assert"
)

func TestUserRepositoryImpl_Create(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Test basic creation
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)
		assert.NotEmpty(t, user.ID)
		assert.Equal(t, "testuser", user.Name)
		assert.Equal(t, roles, user.Roles)

		// Verify created user can be retrieved
		retrievedUser, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)
		// assert.Equal(t, user.ID, retrievedUser.ID)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.Equal(t, user.Roles, retrievedUser.Roles)
	})
}

func TestUserRepositoryImpl_GetByID(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Test getting existing user by ID
		retrievedUser, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, user.ID, retrievedUser.ID)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.Equal(t, user.Roles, retrievedUser.Roles)

		// Test getting non-existent user
		nonExistentUser, exists, err := userRdsImpl.GetByID(ctx, entity.UserIDEntity("u-non-existent"))
		assert.Nil(t, err)
		assert.False(t, exists)
		assert.Empty(t, nonExistentUser.ID)
	})
}

func TestUserRepositoryImpl_GetByUsername(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser, entity.UserRoleAdmin}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Test getting existing user by username
		retrievedUser, exists, err := userRdsImpl.GetByUsername(ctx, "testuser")
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, user.ID, retrievedUser.ID)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.Equal(t, user.Roles, retrievedUser.Roles)

		// Test getting non-existent user
		nonExistentUser, exists, err := userRdsImpl.GetByUsername(ctx, "nonexistent")
		assert.Nil(t, err)
		assert.False(t, exists)
		assert.Empty(t, nonExistentUser.ID)
	})
}

func TestUserRepositoryImpl_GetByEmail(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Update user with email
		email := "test@example.com"
		user.Mail = &email
		err = userRdsImpl.Update(ctx, user)
		assert.Nil(t, err)

		// Test getting existing user by email
		retrievedUser, exists, err := userRdsImpl.GetByEmail(ctx, email)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, user.ID, retrievedUser.ID)
		assert.Equal(t, user.Name, retrievedUser.Name)
		assert.NotNil(t, retrievedUser.Mail)
		assert.Equal(t, email, *retrievedUser.Mail)

		// Test getting non-existent user
		nonExistentUser, exists, err := userRdsImpl.GetByEmail(ctx, "nonexistent@example.com")
		assert.Nil(t, err)
		assert.False(t, exists)
		assert.Empty(t, nonExistentUser.ID)
	})
}

func TestUserRepositoryImpl_Update(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Update user information
		newEmail := "updated@example.com"
		newUsername := "updateduser"
		newRoles := []entity.UserRoleEntity{entity.UserRoleUser, entity.UserRoleAdmin}
		user.Mail = &newEmail
		user.Name = newUsername
		user.Roles = newRoles

		err = userRdsImpl.Update(ctx, user)
		assert.Nil(t, err)

		// Verify updates
		retrievedUser, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, newUsername, retrievedUser.Name)
		assert.NotNil(t, retrievedUser.Mail)
		assert.Equal(t, newEmail, *retrievedUser.Mail)
		assert.Equal(t, newRoles, retrievedUser.Roles)
	})
}

func TestUserRepositoryImpl_Delete(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Verify user exists
		_, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)

		// Delete user
		err = userRdsImpl.Delete(ctx, user.ID)
		assert.Nil(t, err)

		// Verify user no longer exists
		_, exists, err = userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.False(t, exists)
	})
}

func TestUserRepositoryImpl_UpdatePassword(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Set initial password
		initialPassword := "password123"
		err = userRdsImpl.UpdatePassword(ctx, user.ID, initialPassword)
		assert.Nil(t, err)

		// Verify password was set
		retrievedUser, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.NotNil(t, retrievedUser.PasswordHash)

		// Update to new password
		newPassword := "newpassword456"
		err = userRdsImpl.UpdatePassword(ctx, user.ID, newPassword)
		assert.Nil(t, err)

		// Verify password was updated (hash should be different)
		updatedUser, exists, err := userRdsImpl.GetByID(ctx, user.ID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.NotNil(t, updatedUser.PasswordHash)
		assert.NotEqual(t, *retrievedUser.PasswordHash, *updatedUser.PasswordHash)
	})
}

func TestUserRepositoryImpl_ValidateCredentialsByUsername(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Set password
		password := "password123"
		err = userRdsImpl.UpdatePassword(ctx, user.ID, password)
		assert.Nil(t, err)

		// Test valid credentials
		validatedUser, valid, err := userRdsImpl.ValidateCredentialsByUsername(ctx, "testuser", password)
		assert.Nil(t, err)
		assert.True(t, valid)
		assert.Equal(t, user.ID, validatedUser.ID)
		assert.Equal(t, user.Name, validatedUser.Name)

		// Test invalid password
		_, valid, err = userRdsImpl.ValidateCredentialsByUsername(ctx, "testuser", "wrongpassword")
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test non-existent username
		_, valid, err = userRdsImpl.ValidateCredentialsByUsername(ctx, "nonexistent", password)
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test user without password
		userNoPassword, err := userRdsImpl.Create(ctx, "usernopassword", roles)
		assert.Nil(t, err)
		_, valid, err = userRdsImpl.ValidateCredentialsByUsername(ctx, userNoPassword.Name, "anypassword")
		assert.Nil(t, err)
		assert.False(t, valid)
	})
}

func TestUserRepositoryImpl_ValidateCredentialsByEmail(t *testing.T) {
	uintTestCtx := unittest.GetUnitTestCtx()

	uintTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		userRdsImpl := NewUserRepositoryRdsImpl(uintTestCtx.Config, sqliteClient)

		// Create a test user
		roles := []entity.UserRoleEntity{entity.UserRoleUser}
		user, err := userRdsImpl.Create(ctx, "testuser", roles)
		assert.Nil(t, err)

		// Set email
		email := "test@example.com"
		user.Mail = &email
		err = userRdsImpl.Update(ctx, user)
		assert.Nil(t, err)

		// Set password
		password := "password123"
		err = userRdsImpl.UpdatePassword(ctx, user.ID, password)
		assert.Nil(t, err)

		// Test valid credentials
		validatedUser, valid, err := userRdsImpl.ValidateCredentialsByEmail(ctx, email, password)
		assert.Nil(t, err)
		assert.True(t, valid)
		assert.Equal(t, user.ID, validatedUser.ID)
		assert.Equal(t, user.Name, validatedUser.Name)
		assert.NotNil(t, validatedUser.Mail)
		assert.Equal(t, email, *validatedUser.Mail)

		// Test invalid password
		_, valid, err = userRdsImpl.ValidateCredentialsByEmail(ctx, email, "wrongpassword")
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test non-existent email
		_, valid, err = userRdsImpl.ValidateCredentialsByEmail(ctx, "nonexistent@example.com", password)
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test user without password
		userNoPassword, err := userRdsImpl.Create(ctx, "usernopassword", roles)
		assert.Nil(t, err)
		emailNoPassword := "nopassword@example.com"
		userNoPassword.Mail = &emailNoPassword
		err = userRdsImpl.Update(ctx, userNoPassword)
		assert.Nil(t, err)
		_, valid, err = userRdsImpl.ValidateCredentialsByEmail(ctx, emailNoPassword, "anypassword")
		assert.Nil(t, err)
		assert.False(t, valid)
	})
}
