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

func createTestPasskeyEntity(userID entity.UserIDEntity) entity.PasskeyEntity {
	transports := "usb,nfc"
	deviceName := "Test Device"
	backupEligible := true
	backupState := false

	return entity.NewPasskeyEntity(
		userID,
		[]byte("test-credential-id"),
		[]byte("test-public-key"),
		0,
		[]byte("test-aaguid-1234"),
		&transports,
		&deviceName,
		&backupEligible,
		&backupState,
	)
}

func setupPasskeyTest(t *testing.T, ctx context.Context, sqliteClient *client.SqliteClient) (*PasskeyRepositoryRdsImpl, entity.UserIDEntity) {
	unitTestCtx := unittest.GetUnitTestCtx()

	// Create a user first since passkeys reference user_id
	userRdsImpl := NewUserRepositoryRdsImpl(unitTestCtx.Config, sqliteClient)
	user, err := userRdsImpl.Create(ctx, "passkeyuser", []entity.UserRoleEntity{entity.UserRoleUser})
	assert.Nil(t, err)

	passkeyRepo := NewPasskeyRepositoryRdsImpl(sqliteClient)
	return passkeyRepo, user.ID
}

func TestPasskeyRepositoryRdsImpl_Create(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		// Verify created passkey can be retrieved
		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, userID, retrieved.UserID)
		assert.Equal(t, passkey.CredentialID, retrieved.CredentialID)
		assert.Equal(t, passkey.PublicKey, retrieved.PublicKey)
		assert.Equal(t, passkey.SignCount, retrieved.SignCount)
		assert.Equal(t, passkey.AAGUID, retrieved.AAGUID)
		assert.NotNil(t, retrieved.Transports)
		assert.Equal(t, *passkey.Transports, *retrieved.Transports)
		assert.NotNil(t, retrieved.DeviceName)
		assert.Equal(t, *passkey.DeviceName, *retrieved.DeviceName)
		assert.NotNil(t, retrieved.BackupEligible)
		assert.Equal(t, *passkey.BackupEligible, *retrieved.BackupEligible)
		assert.NotNil(t, retrieved.BackupState)
		assert.Equal(t, *passkey.BackupState, *retrieved.BackupState)
	})
}

func TestPasskeyRepositoryRdsImpl_Create_NilOptionalFields(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := entity.NewPasskeyEntity(
			userID,
			[]byte("cred-no-optionals"),
			[]byte("pub-key"),
			0,
			[]byte("aaguid-12345678"),
			nil, nil, nil, nil,
		)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Nil(t, retrieved.Transports)
		assert.Nil(t, retrieved.DeviceName)
		assert.Nil(t, retrieved.BackupEligible)
		assert.Nil(t, retrieved.BackupState)
	})
}

func TestPasskeyRepositoryRdsImpl_GetByCredentialID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		// Test existing credential
		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, userID, retrieved.UserID)

		// Test non-existent credential
		_, exists, err = passkeyRepo.GetByCredentialID(ctx, []byte("non-existent"))
		assert.Nil(t, err)
		assert.False(t, exists)
	})
}

func TestPasskeyRepositoryRdsImpl_GetByUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		// Create multiple passkeys for the same user
		passkey1 := createTestPasskeyEntity(userID)
		passkey1.CredentialID = []byte("cred-1")
		err := passkeyRepo.Create(ctx, passkey1)
		assert.Nil(t, err)

		time.Sleep(10 * time.Millisecond) // ensure different created_at for ordering

		passkey2 := createTestPasskeyEntity(userID)
		passkey2.CredentialID = []byte("cred-2")
		err = passkeyRepo.Create(ctx, passkey2)
		assert.Nil(t, err)

		// Retrieve all passkeys for user
		passkeys, err := passkeyRepo.GetByUserID(ctx, userID)
		assert.Nil(t, err)
		assert.Len(t, passkeys, 2)
		assert.Equal(t, []byte("cred-1"), passkeys[0].CredentialID)
		assert.Equal(t, []byte("cred-2"), passkeys[1].CredentialID)

		// Test non-existent user returns empty slice
		passkeys, err = passkeyRepo.GetByUserID(ctx, entity.UserIDEntity("u-non-existent"))
		assert.Nil(t, err)
		assert.Empty(t, passkeys)
	})
}

func TestPasskeyRepositoryRdsImpl_UpdateSignCount(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		// Get the created passkey to obtain its ID
		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, int64(0), retrieved.SignCount)

		// Update sign count
		err = passkeyRepo.UpdateSignCount(ctx, retrieved.ID, 5)
		assert.Nil(t, err)

		// Verify updated
		updated, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Equal(t, int64(5), updated.SignCount)
	})
}

func TestPasskeyRepositoryRdsImpl_UpdateLastUsedAt(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		// Get the created passkey - last_used_at should be nil
		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.Nil(t, retrieved.LastUsedAt)

		// Update last used at
		err = passkeyRepo.UpdateLastUsedAt(ctx, retrieved.ID)
		assert.Nil(t, err)

		// Verify updated
		updated, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
		assert.NotNil(t, updated.LastUsedAt)
	})
}

func TestPasskeyRepositoryRdsImpl_Delete(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		// Get ID
		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)

		// Delete the passkey
		err = passkeyRepo.Delete(ctx, retrieved.ID, userID)
		assert.Nil(t, err)

		// Verify deleted
		_, exists, err = passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.False(t, exists)
	})
}

func TestPasskeyRepositoryRdsImpl_Delete_WrongUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		passkey := createTestPasskeyEntity(userID)
		err := passkeyRepo.Create(ctx, passkey)
		assert.Nil(t, err)

		retrieved, exists, err := passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)

		// Delete with wrong user ID should not delete
		err = passkeyRepo.Delete(ctx, retrieved.ID, entity.UserIDEntity("u-wrong-user"))
		assert.Nil(t, err) // no error, just no rows affected

		// Verify passkey still exists
		_, exists, err = passkeyRepo.GetByCredentialID(ctx, passkey.CredentialID)
		assert.Nil(t, err)
		assert.True(t, exists)
	})
}

func TestPasskeyRepositoryRdsImpl_DeleteByUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearSqlite(func(ctx context.Context, sqliteClient *client.SqliteClient) {
		passkeyRepo, userID := setupPasskeyTest(t, ctx, sqliteClient)

		// Create multiple passkeys
		passkey1 := createTestPasskeyEntity(userID)
		passkey1.CredentialID = []byte("cred-del-1")
		err := passkeyRepo.Create(ctx, passkey1)
		assert.Nil(t, err)

		passkey2 := createTestPasskeyEntity(userID)
		passkey2.CredentialID = []byte("cred-del-2")
		err = passkeyRepo.Create(ctx, passkey2)
		assert.Nil(t, err)

		// Verify both exist
		passkeys, err := passkeyRepo.GetByUserID(ctx, userID)
		assert.Nil(t, err)
		assert.Len(t, passkeys, 2)

		// Delete all passkeys for user
		err = passkeyRepo.DeleteByUserID(ctx, userID)
		assert.Nil(t, err)

		// Verify all deleted
		passkeys, err = passkeyRepo.GetByUserID(ctx, userID)
		assert.Nil(t, err)
		assert.Empty(t, passkeys)
	})
}

func TestEncodeDecodePasskeyExtraInfo(t *testing.T) {
	// Test with all fields set
	backupEligible := true
	backupState := false
	encoded, err := encodePasskeyExtraInfo(&backupEligible, &backupState)
	assert.Nil(t, err)

	decoded := decodePasskeyExtraInfo(encoded)
	assert.NotNil(t, decoded.backupEligible)
	assert.True(t, *decoded.backupEligible)
	assert.NotNil(t, decoded.backupState)
	assert.False(t, *decoded.backupState)

	// Test with nil fields
	encoded, err = encodePasskeyExtraInfo(nil, nil)
	assert.Nil(t, err)

	decoded = decodePasskeyExtraInfo(encoded)
	assert.Nil(t, decoded.backupEligible)
	assert.Nil(t, decoded.backupState)

	// Test decoding empty string
	decoded = decodePasskeyExtraInfo("")
	assert.Nil(t, decoded.backupEligible)
	assert.Nil(t, decoded.backupState)

	// Test decoding invalid JSON
	decoded = decodePasskeyExtraInfo("invalid json")
	assert.Nil(t, decoded.backupEligible)
	assert.Nil(t, decoded.backupState)
}
