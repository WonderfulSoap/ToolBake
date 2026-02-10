package repository_impl

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"
	"ya-tool-craft/internal/utils"

	"github.com/nutsdb/nutsdb"
	"github.com/stretchr/testify/assert"
)

func TestAuthRefreshTokenRepositoryNutsDBImpl_IssueRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Test issuing a refresh token
		userID := entity.UserIDEntity("u-test-user-123")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)
		assert.NotEmpty(t, token.Token)
		assert.Equal(t, userID, token.UserID)
		assert.True(t, token.Token[:3] == "rt-") // token should start with "rt-"
		assert.False(t, token.IssueAt.IsZero())
		assert.False(t, token.ExpireAt.IsZero())
		assert.True(t, token.ExpireAt.After(token.IssueAt))
		assert.Equal(t, utils.Sha256String(token.Token), token.TokenHash)

		// Verify the token can be validated
		_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
		assert.Nil(t, err)
		assert.True(t, valid)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_ValidateRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Issue a token first
		userID := entity.UserIDEntity("u-test-user-456")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)

		// Test validating existing token
		refreshToken, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
		assert.Nil(t, err)
		assert.True(t, valid)
		assert.Equal(t, userID, refreshToken.UserID)
		assert.Equal(t, token.Token, refreshToken.Token)
		assert.Equal(t, utils.Sha256String(refreshToken.Token), refreshToken.TokenHash)

		// Test validating by token hash
		tokenHash := utils.Sha256String(token.Token)
		refreshTokenByHash, valid, err := authTokenRepo.ValidateRefreshTokenHash(ctx, tokenHash)
		assert.Nil(t, err)
		assert.True(t, valid)
		assert.Equal(t, refreshToken, refreshTokenByHash)

		// Test validating non-existent token
		_, valid, err = authTokenRepo.ValidateRefreshToken(ctx, "rt-non-existent-token")
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test validating non-existent token hash
		_, valid, err = authTokenRepo.ValidateRefreshTokenHash(ctx, utils.Sha256String("rt-non-existent-token"))
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test validating invalid token format
		_, valid, err = authTokenRepo.ValidateRefreshToken(ctx, "invalid-token")
		assert.Nil(t, err)
		assert.False(t, valid)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Issue a token first
		userID := entity.UserIDEntity("u-test-user-789")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)

		// Verify token exists
		_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
		assert.Nil(t, err)
		assert.True(t, valid)

		// Delete the token
		err = authTokenRepo.DeleteRefreshToken(ctx, token.Token)
		assert.Nil(t, err)

		// Verify token no longer exists
		_, valid, err = authTokenRepo.ValidateRefreshToken(ctx, token.Token)
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test deleting non-existent token (should not error)
		err = authTokenRepo.DeleteRefreshToken(ctx, "rt-non-existent-token")
		assert.Nil(t, err)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteRefreshTokenByHash(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Issue a token first
		userID := entity.UserIDEntity("u-test-user-hash")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)

		tokenHash := token.TokenHash

		// Verify token exists by hash
		_, valid, err := authTokenRepo.ValidateRefreshTokenHash(ctx, tokenHash)
		assert.Nil(t, err)
		assert.True(t, valid)

		// Delete the token by hash
		err = authTokenRepo.DeleteRefreshTokenByHash(ctx, tokenHash)
		assert.Nil(t, err)

		// Verify token no longer exists
		_, valid, err = authTokenRepo.ValidateRefreshTokenHash(ctx, tokenHash)
		assert.Nil(t, err)
		assert.False(t, valid)

		// Test deleting non-existent token hash (should not error)
		err = authTokenRepo.DeleteRefreshTokenByHash(ctx, utils.Sha256String("rt-non-existent-token"))
		assert.Nil(t, err)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteRefreshTokenByHash_ReturnErrorOnCorruptedTokenData(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		tokenHash := utils.Sha256String("rt-corrupted-token")
		err := nutsDBClient.DB.Update(func(tx *nutsdb.Tx) error {
			return tx.Put(nutsdbRefreshTokenBucket, []byte(tokenHash), []byte("{invalid-json"), 300)
		})
		assert.Nil(t, err)

		err = authTokenRepo.DeleteRefreshTokenByHash(ctx, tokenHash)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "fail to lookup refresh token before delete")
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteRefreshTokenByHash_ReturnErrorWhenSetRemovalFails(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		userID := entity.UserIDEntity("u-test-user-delete-hash-error")
		token := "rt-test-token-delete-hash-error"
		tokenHash := utils.Sha256String(token)
		now := time.Now().UTC()

		model := RefreshTokenModel{
			UserID:    string(userID),
			Token:     token,
			TokenHash: tokenHash,
			IssueAt:   now,
			ExpireAt:  now.Add(time.Hour),
		}
		data, err := json.Marshal(model)
		assert.Nil(t, err)

		err = nutsDBClient.DB.Update(func(tx *nutsdb.Tx) error {
			if err := tx.Put(nutsdbRefreshTokenBucket, []byte(tokenHash), data, 300); err != nil {
				return err
			}
			return tx.DeleteBucket(nutsdb.DataStructureSet, nutsdbRefreshTokenUserBucket)
		})
		assert.Nil(t, err)

		err = authTokenRepo.DeleteRefreshTokenByHash(ctx, tokenHash)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "fail to delete refresh token from nutsdb")
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_MultipleTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Issue multiple tokens for different users
		userID1 := entity.UserIDEntity("u-test-user-001")
		userID2 := entity.UserIDEntity("u-test-user-002")

		token1, err := authTokenRepo.IssueRefreshToken(ctx, userID1)
		assert.Nil(t, err)

		token2, err := authTokenRepo.IssueRefreshToken(ctx, userID2)
		assert.Nil(t, err)

		// Tokens should be different
		assert.NotEqual(t, token1.Token, token2.Token)

		// Both tokens should be valid
		_, valid1, err := authTokenRepo.ValidateRefreshToken(ctx, token1.Token)
		assert.Nil(t, err)
		assert.True(t, valid1)

		_, valid2, err := authTokenRepo.ValidateRefreshToken(ctx, token2.Token)
		assert.Nil(t, err)
		assert.True(t, valid2)

		// Delete one token
		err = authTokenRepo.DeleteRefreshToken(ctx, token1.Token)
		assert.Nil(t, err)

		// First token should be invalid, second should still be valid
		_, valid1, err = authTokenRepo.ValidateRefreshToken(ctx, token1.Token)
		assert.Nil(t, err)
		assert.False(t, valid1)

		_, valid2, err = authTokenRepo.ValidateRefreshToken(ctx, token2.Token)
		assert.Nil(t, err)
		assert.True(t, valid2)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_TokenExpiration(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	assert.Equal(t, uint64(15778463), unitTestCtx.Config.RefreshTokenTTL, "RefreshTokenTTL should be 15778463 seconds as configured in .env.test")

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Issue a token
		userID := entity.UserIDEntity("u-test-user-expiry")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)

		// Verify expiration time is set correctly based on config
		expectedTTL := time.Duration(unitTestCtx.Config.RefreshTokenTTL) * time.Second
		actualTTL := token.ExpireAt.Sub(token.IssueAt)
		assert.InDelta(t, expectedTTL.Seconds(), actualTTL.Seconds(), 1.0)
		assert.InDelta(t, 15778463.0, actualTTL.Seconds(), 1.0, "Refresh token TTL should be 15778463 seconds")
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_ConcurrentIssueRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		concurrency := 50
		tokensPerGoroutine := 10

		type result struct {
			token entity.RefreshToken
			err   error
		}
		resultChan := make(chan result, concurrency*tokensPerGoroutine)

		var wg sync.WaitGroup
		wg.Add(concurrency)

		for i := 0; i < concurrency; i++ {
			go func(goroutineID int) {
				defer wg.Done()

				for j := 0; j < tokensPerGoroutine; j++ {
					userID := entity.UserIDEntity(fmt.Sprintf("u-concurrent-user-%d-%d", goroutineID, j))
					token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
					resultChan <- result{token: token, err: err}
				}
			}(i)
		}

		wg.Wait()
		close(resultChan)

		tokens := make(map[string]bool)
		errorCount := 0

		for res := range resultChan {
			if res.err != nil {
				errorCount++
				t.Errorf("Error issuing token: %v", res.err)
				continue
			}

			assert.True(t, res.token.Token[:3] == "rt-", "Token should start with 'rt-'")
			assert.NotEmpty(t, res.token.UserID)
			assert.False(t, res.token.IssueAt.IsZero())
			assert.False(t, res.token.ExpireAt.IsZero())

			if tokens[res.token.Token] {
				t.Errorf("Duplicate token found: %s", res.token.Token)
			}
			tokens[res.token.Token] = true

			_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, res.token.Token)
			assert.Nil(t, err)
			assert.True(t, valid, "Token should be valid after issuance")
		}

		assert.Equal(t, 0, errorCount, "No errors should occur during concurrent token issuance")

		expectedTokenCount := concurrency * tokensPerGoroutine
		assert.Equal(t, expectedTokenCount, len(tokens), "All tokens should be unique")

		t.Logf("Successfully issued %d unique tokens concurrently", len(tokens))
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteAllTokensByUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		numUsers := 5
		tokensPerUser := 4
		userToDelete := 2

		userTokens := make(map[int][]entity.RefreshToken)

		for userIdx := 0; userIdx < numUsers; userIdx++ {
			userID := entity.UserIDEntity(fmt.Sprintf("u-test-user-delete-all-%d", userIdx))
			userTokens[userIdx] = make([]entity.RefreshToken, 0, tokensPerUser)

			for tokenIdx := 0; tokenIdx < tokensPerUser; tokenIdx++ {
				token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
				assert.Nil(t, err, "Failed to issue token for user %d, token %d", userIdx, tokenIdx)
				userTokens[userIdx] = append(userTokens[userIdx], token)
			}
		}

		// Verify all tokens are valid before deletion
		for userIdx := 0; userIdx < numUsers; userIdx++ {
			for tokenIdx, token := range userTokens[userIdx] {
				_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
				assert.Nil(t, err, "Failed to validate token for user %d, token %d", userIdx, tokenIdx)
				assert.True(t, valid, "Token should be valid for user %d, token %d", userIdx, tokenIdx)
			}
		}

		// Delete all tokens for the target user
		targetUserID := entity.UserIDEntity(fmt.Sprintf("u-test-user-delete-all-%d", userToDelete))
		err := authTokenRepo.DeleteAllTokensByUserID(ctx, targetUserID)
		assert.Nil(t, err, "Failed to delete tokens for user %d", userToDelete)

		// Verify the deleted user's tokens are all invalid
		for tokenIdx, token := range userTokens[userToDelete] {
			_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
			assert.Nil(t, err, "Failed to validate deleted token %d for user %d", tokenIdx, userToDelete)
			assert.False(t, valid, "Token %d for deleted user %d should be invalid", tokenIdx, userToDelete)
		}

		// Verify all other users' tokens are still valid
		for userIdx := 0; userIdx < numUsers; userIdx++ {
			if userIdx == userToDelete {
				continue
			}
			for tokenIdx, token := range userTokens[userIdx] {
				_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
				assert.Nil(t, err, "Failed to validate token for user %d, token %d", userIdx, tokenIdx)
				assert.True(t, valid, "Token %d for user %d should still be valid", tokenIdx, userIdx)
			}
		}
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteAllTokensByUserID_NoTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Delete tokens for a user that has no tokens (should not error)
		userID := entity.UserIDEntity("u-test-user-no-tokens")
		err := authTokenRepo.DeleteAllTokensByUserID(ctx, userID)
		assert.Nil(t, err)
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_DeleteAllTokensByUserID_ReturnErrorOnDeleteFailure(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		userID := entity.UserIDEntity("u-test-user-delete-all-error")
		err := nutsDBClient.DB.Update(func(tx *nutsdb.Tx) error {
			if err := tx.SAdd(nutsdbRefreshTokenUserBucket, []byte(string(userID)), []byte("stale-token-hash")); err != nil {
				return err
			}
			return tx.DeleteBucket(nutsdb.DataStructureBTree, nutsdbRefreshTokenBucket)
		})
		assert.Nil(t, err)

		err = authTokenRepo.DeleteAllTokensByUserID(ctx, userID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "fail to delete user refresh tokens from nutsdb")
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_CleanupExpiredTokenHashesForUser(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		// use a short TTL config to test expiration cleanup
		shortTTLConfig := unitTestCtx.Config
		shortTTLConfig.RefreshTokenTTL = 2 // 2 seconds

		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(shortTTLConfig, nutsDBClient)

		userID := entity.UserIDEntity(fmt.Sprintf("u-test-cleanup-user-%d", time.Now().UnixNano()))

		// Issue 3 tokens with short TTL
		for i := 0; i < 3; i++ {
			_, err := authTokenRepo.IssueRefreshToken(ctx, userID)
			assert.Nil(t, err)
		}

		// Switch to long TTL and issue 2 more tokens that won't expire
		longTTLConfig := unitTestCtx.Config
		longTTLConfig.RefreshTokenTTL = 3600
		authTokenRepoLong := NewAuthRefreshTokenRepositoryNutsDBImpl(longTTLConfig, nutsDBClient)

		var validTokens []entity.RefreshToken
		for i := 0; i < 2; i++ {
			token, err := authTokenRepoLong.IssueRefreshToken(ctx, userID)
			assert.Nil(t, err)
			validTokens = append(validTokens, token)
		}

		// Verify set has 5 members
		var memberCount int
		nutsDBClient.DB.View(func(tx *nutsdb.Tx) error {
			members, err := tx.SMembers(nutsdbRefreshTokenUserBucket, []byte(string(userID)))
			if err != nil {
				return err
			}
			memberCount = len(members)
			return nil
		})
		assert.Equal(t, 5, memberCount)

		// Wait for the short-TTL tokens to expire
		time.Sleep(3 * time.Second)

		// Run cleanup
		err := authTokenRepoLong.CleanupExpiredTokenHashesForUser(ctx, userID)
		assert.Nil(t, err)

		// Verify set now has only 2 members (the valid ones)
		nutsDBClient.DB.View(func(tx *nutsdb.Tx) error {
			members, err := tx.SMembers(nutsdbRefreshTokenUserBucket, []byte(string(userID)))
			if err != nil {
				return err
			}
			memberCount = len(members)
			return nil
		})
		assert.Equal(t, 2, memberCount)

		// Verify the valid tokens still work
		for _, token := range validTokens {
			_, valid, err := authTokenRepoLong.ValidateRefreshToken(ctx, token.Token)
			assert.Nil(t, err)
			assert.True(t, valid)
		}
	})
}

func TestAuthRefreshTokenRepositoryNutsDBImpl_CleanupExpiredTokenHashesForUser_NoTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearNutsDB(func(ctx context.Context, nutsDBClient *client.NutsDBClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryNutsDBImpl(unitTestCtx.Config, nutsDBClient)

		// Cleanup for a user with no tokens (should not error)
		userID := entity.UserIDEntity("u-test-user-no-tokens-cleanup")
		err := authTokenRepo.CleanupExpiredTokenHashesForUser(ctx, userID)
		assert.Nil(t, err)
	})
}
