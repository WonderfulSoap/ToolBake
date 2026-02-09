package repository_impl

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/unittest"
	"ya-tool-craft/internal/utils"

	"github.com/stretchr/testify/assert"
)

func TestAuthRefreshTokenRepositoryImpl_IssueRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

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

func TestAuthRefreshTokenRepositoryImpl_ValidateRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

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

func TestAuthRefreshTokenRepositoryImpl_DeleteRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

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

func TestAuthRefreshTokenRepositoryImpl_DeleteRefreshTokenByHash(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

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

func TestAuthRefreshTokenRepositoryImpl_MultipleTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

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

func TestAuthRefreshTokenRepositoryImpl_TokenExpiration(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	// Verify config value matches .env.test: REFRESH_TOKEN_TTL="15778463"
	assert.Equal(t, uint64(15778463), unitTestCtx.Config.RefreshTokenTTL, "RefreshTokenTTL should be 15778463 seconds as configured in .env.test")

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

		// Issue a token
		userID := entity.UserIDEntity("u-test-user-expiry")
		token, err := authTokenRepo.IssueRefreshToken(ctx, userID)
		assert.Nil(t, err)

		// Verify expiration time is set correctly based on config
		expectedTTL := time.Duration(unitTestCtx.Config.RefreshTokenTTL) * time.Second
		actualTTL := token.ExpireAt.Sub(token.IssueAt)
		assert.InDelta(t, expectedTTL.Seconds(), actualTTL.Seconds(), 1.0) // allow 1 second difference

		// Verify the actual TTL matches the expected value from .env.test (15778463 seconds ≈ 182.6 days)
		assert.InDelta(t, 15778463.0, actualTTL.Seconds(), 1.0, "Refresh token TTL should be 15778463 seconds")
	})
}

func TestAuthRefreshTokenRepositoryImpl_ConcurrentIssueRefreshToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

		// Number of concurrent goroutines
		concurrency := 50
		tokensPerGoroutine := 10

		// Channel to collect results
		type result struct {
			token entity.RefreshToken
			err   error
		}
		resultChan := make(chan result, concurrency*tokensPerGoroutine)

		// Use sync.WaitGroup to wait for all goroutines
		var wg sync.WaitGroup
		wg.Add(concurrency)

		// Launch multiple goroutines to issue tokens concurrently
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

		// Wait for all goroutines to complete
		wg.Wait()
		close(resultChan)

		// Collect and verify all results
		tokens := make(map[string]bool)
		errorCount := 0

		for res := range resultChan {
			if res.err != nil {
				errorCount++
				t.Errorf("Error issuing token: %v", res.err)
				continue
			}

			// Verify token format
			assert.True(t, res.token.Token[:3] == "rt-", "Token should start with 'rt-'")
			assert.NotEmpty(t, res.token.UserID)
			assert.False(t, res.token.IssueAt.IsZero())
			assert.False(t, res.token.ExpireAt.IsZero())

			// Check for duplicate tokens
			if tokens[res.token.Token] {
				t.Errorf("Duplicate token found: %s", res.token.Token)
			}
			tokens[res.token.Token] = true

			// Verify the token can be validated
			_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, res.token.Token)
			assert.Nil(t, err)
			assert.True(t, valid, "Token should be valid after issuance")
		}

		// Verify no errors occurred
		assert.Equal(t, 0, errorCount, "No errors should occur during concurrent token issuance")

		// Verify all tokens are unique
		expectedTokenCount := concurrency * tokensPerGoroutine
		assert.Equal(t, expectedTokenCount, len(tokens), "All tokens should be unique")

		t.Logf("Successfully issued %d unique tokens concurrently", len(tokens))
	})
}

func TestAuthRefreshTokenRepositoryImpl_DeleteAllTokensByUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

		// Create 5 users, each with 4 tokens
		numUsers := 5
		tokensPerUser := 4
		userToDelete := 2 // Delete user at index 2 (middle user)

		// Map to store all tokens: userIndex -> []tokens
		userTokens := make(map[int][]entity.RefreshToken)

		// Issue tokens for all users
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

		t.Logf("Created %d users with %d tokens each (total: %d tokens)", numUsers, tokensPerUser, numUsers*tokensPerUser)

		// Delete all tokens for the target user
		targetUserID := entity.UserIDEntity(fmt.Sprintf("u-test-user-delete-all-%d", userToDelete))
		err := authTokenRepo.DeleteAllTokensByUserID(ctx, targetUserID)
		assert.Nil(t, err, "Failed to delete tokens for user %d", userToDelete)

		t.Logf("Deleted all tokens for user %d", userToDelete)

		// Verify the deleted user's tokens are all invalid
		for tokenIdx, token := range userTokens[userToDelete] {
			_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
			assert.Nil(t, err, "Failed to validate deleted token %d for user %d", tokenIdx, userToDelete)
			assert.False(t, valid, "Token %d for deleted user %d should be invalid", tokenIdx, userToDelete)
		}

		// Verify all other users' tokens are still valid
		for userIdx := 0; userIdx < numUsers; userIdx++ {
			if userIdx == userToDelete {
				continue // Skip the deleted user
			}
			for tokenIdx, token := range userTokens[userIdx] {
				_, valid, err := authTokenRepo.ValidateRefreshToken(ctx, token.Token)
				assert.Nil(t, err, "Failed to validate token for user %d, token %d", userIdx, tokenIdx)
				assert.True(t, valid, "Token %d for user %d should still be valid", tokenIdx, userIdx)
			}
		}

		t.Logf("Verified: user %d's %d tokens deleted, other %d users' %d tokens unaffected",
			userToDelete, tokensPerUser, numUsers-1, (numUsers-1)*tokensPerUser)
	})
}

func TestAuthRefreshTokenRepositoryImpl_DeleteAllTokensByUserID_NoTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	unitTestCtx.WithClearBadger(func(ctx context.Context, badgerClient *client.BadgerClient) {
		authTokenRepo := NewAuthRefreshTokenRepositoryBadgerImpl(unitTestCtx.Config, badgerClient)

		// Delete tokens for a user that has no tokens (should not error)
		userID := entity.UserIDEntity("u-test-user-no-tokens")
		err := authTokenRepo.DeleteAllTokensByUserID(ctx, userID)
		assert.Nil(t, err)
	})
}
