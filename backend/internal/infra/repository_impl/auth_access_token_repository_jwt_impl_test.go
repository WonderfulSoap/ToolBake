package repository_impl

import (
	"context"
	"testing"
	"time"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/unittest"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestAuthAccessTokenRepositoryImpl_IssueAccessToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	// Test issuing an access token
	userID := entity.UserIDEntity("u-test-user-123")
	refreshToken := "rt-test-refresh-token-123"
	token, err := repo.IssueAccessToken(context.Background(), userID, refreshToken)
	assert.Nil(t, err)
	assert.NotEmpty(t, token.Token)
	assert.Equal(t, userID, token.UserID)
	assert.Equal(t, refreshToken, token.RelativeRefreshToken)
	assert.False(t, token.IssueAt.IsZero())
	assert.False(t, token.ExpireAt.IsZero())
	assert.True(t, token.ExpireAt.After(token.IssueAt))

	// Verify the token can be validated
	validatedToken, valid, err := repo.ValidateAccessToken(context.Background(), token.Token)
	assert.Nil(t, err)
	assert.True(t, valid)
	assert.Equal(t, userID, validatedToken.UserID)
	assert.Equal(t, token.Token, validatedToken.Token)
	assert.Equal(t, refreshToken, validatedToken.RelativeRefreshToken)
}

func TestAuthAccessTokenRepositoryImpl_ValidateAccessToken(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)
	// Issue a token first
	userID := entity.UserIDEntity("u-test-user-456")
	refreshToken := "rt-test-refresh-token-456"
	token, err := repo.IssueAccessToken(context.Background(), userID, refreshToken)
	assert.Nil(t, err)

	// Test validating existing token
	accessToken, valid, err := repo.ValidateAccessToken(context.Background(), token.Token)
	assert.Nil(t, err)
	assert.True(t, valid)
	assert.Equal(t, userID, accessToken.UserID)
	assert.Equal(t, token.Token, accessToken.Token)

	// Test validating invalid token - should return error
	_, valid, err = repo.ValidateAccessToken(context.Background(), "invalid-token")
	assert.Nil(t, err)
	assert.False(t, valid)

	// Test validating token with wrong signature - should return error
	_, valid, err = repo.ValidateAccessToken(context.Background(), "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidS10ZXN0LXVzZXItNDU2Iiwicm9sZXMiOlsidXNlciJdLCJleHAiOjE3MDAwMDAwMDAsImlhdCI6MTcwMDAwMDAwMH0.invalid")
	assert.Nil(t, err)
	assert.False(t, valid)
}

func TestAuthAccessTokenRepositoryImpl_ValidateAccessToken_MissingTimeClaims(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()
	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	userID := entity.UserIDEntity("u-test-user-missing-claims")
	refreshToken := "rt-test-refresh-token-missing-claims"
	secret := []byte(unitTestCtx.WritableConfig.Value.JWTSecret)

	testCases := []struct {
		name  string
		claim jwt.RegisteredClaims
	}{
		{
			name: "missing-exp",
			claim: jwt.RegisteredClaims{
				IssuedAt: jwt.NewNumericDate(time.Now()),
				Subject:  string(userID),
			},
		},
		{
			name: "missing-iat",
			claim: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
				Subject:   string(userID),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, JWTClaims{
				UserID:                   string(userID),
				RelativeRefreshTokenHash: refreshToken,
				RegisteredClaims:         tc.claim,
			})
			tokenString, err := token.SignedString(secret)
			assert.Nil(t, err)

			assert.NotPanics(t, func() {
				_, valid, err := repo.ValidateAccessToken(context.Background(), tokenString)
				assert.Nil(t, err)
				assert.False(t, valid)
			})
		})
	}
}

func TestAuthAccessTokenRepositoryImpl_TokenExpiration(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	// Verify config value matches .env.test: ACCESS_TOKEN_TTL="300"
	assert.Equal(t, uint64(300), unitTestCtx.Config.AccessTokenTTL, "AccessTokenTTL should be 300 seconds as configured in .env.test")

	// Issue a token
	userID := entity.UserIDEntity("u-test-user-expiry")
	refreshToken := "rt-test-refresh-token-expiry"
	token, err := repo.IssueAccessToken(context.Background(), userID, refreshToken)
	assert.Nil(t, err)

	// Verify expiration time is set correctly based on config
	expectedTTL := time.Duration(unitTestCtx.Config.AccessTokenTTL) * time.Second
	actualTTL := token.ExpireAt.Sub(token.IssueAt)
	assert.InDelta(t, expectedTTL.Seconds(), actualTTL.Seconds(), 1.0) // allow 1 second difference

	// Verify the actual TTL matches the expected value from .env.test (300 seconds)
	assert.InDelta(t, 300.0, actualTTL.Seconds(), 1.0, "Access token TTL should be 300 seconds")
}

func TestAuthAccessTokenRepositoryImpl_MultipleTokens(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	// Issue multiple tokens for different users
	userID1 := entity.UserIDEntity("u-test-user-001")
	userID2 := entity.UserIDEntity("u-test-user-002")
	refreshToken1 := "rt-test-refresh-token-001"
	refreshToken2 := "rt-test-refresh-token-002"

	token1, err := repo.IssueAccessToken(context.Background(), userID1, refreshToken1)
	assert.Nil(t, err)

	token2, err := repo.IssueAccessToken(context.Background(), userID2, refreshToken2)
	assert.Nil(t, err)

	// Tokens should be different
	assert.NotEqual(t, token1.Token, token2.Token)

	// Both tokens should be valid
	validatedToken1, valid1, err := repo.ValidateAccessToken(context.Background(), token1.Token)
	assert.Nil(t, err)
	assert.True(t, valid1)
	assert.Equal(t, userID1, validatedToken1.UserID)
	assert.Equal(t, refreshToken1, validatedToken1.RelativeRefreshToken)

	validatedToken2, valid2, err := repo.ValidateAccessToken(context.Background(), token2.Token)
	assert.Nil(t, err)
	assert.True(t, valid2)
	assert.Equal(t, userID2, validatedToken2.UserID)
	assert.Equal(t, refreshToken2, validatedToken2.RelativeRefreshToken)
}

func TestAuthAccessTokenRepositoryImpl_JWTStructure(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	// Issue a token
	userID := entity.UserIDEntity("u-test-user-jwt")
	refreshToken := "rt-test-refresh-token-jwt"
	token, err := repo.IssueAccessToken(context.Background(), userID, refreshToken)
	assert.Nil(t, err)

	// Verify token is a valid JWT (should have 3 parts separated by dots)
	parts := len(token.Token)
	assert.True(t, parts > 0)

	// Validate the token and check claims
	validatedToken, valid, err := repo.ValidateAccessToken(context.Background(), token.Token)
	assert.Nil(t, err)
	assert.True(t, valid)
	assert.Equal(t, userID, validatedToken.UserID)
	assert.Equal(t, refreshToken, validatedToken.RelativeRefreshToken)
	assert.Equal(t, token.IssueAt.Unix(), validatedToken.IssueAt.Unix())
	assert.Equal(t, token.ExpireAt.Unix(), validatedToken.ExpireAt.Unix())
}

func TestAuthAccessTokenRepositoryImpl_DeleteAllTokensByUserID(t *testing.T) {
	unitTestCtx := unittest.GetUnitTestCtx()

	repo := NewAuthAccessTokenRepositoryJWTImpl(unitTestCtx.Config, unitTestCtx.WritableConfig)

	// Issue a token
	userID := entity.UserIDEntity("u-test-user-delete-all")
	refreshToken := "rt-test-refresh-token-delete-all"
	token, err := repo.IssueAccessToken(context.Background(), userID, refreshToken)
	assert.Nil(t, err)

	// Verify token is valid before delete
	_, valid, err := repo.ValidateAccessToken(context.Background(), token.Token)
	assert.Nil(t, err)
	assert.True(t, valid)

	// DeleteAllTokensByUserID should return nil (JWT is stateless)
	err = repo.DeleteAllTokensByUserID(context.Background(), userID)
	assert.Nil(t, err)

	// Token is still valid because JWT is stateless
	_, valid, err = repo.ValidateAccessToken(context.Background(), token.Token)
	assert.Nil(t, err)
	assert.True(t, valid)
}
