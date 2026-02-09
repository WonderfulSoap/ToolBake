package repository_impl

import (
	"context"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/utils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pkg/errors"
)

func NewAuthAccessTokenRepositoryJWTImpl(cfg config.Config, writable config.WritableConfig) *AuthAccessTokenRepositoryJWTImpl {
	return &AuthAccessTokenRepositoryJWTImpl{
		config:         cfg,
		writableConfig: writable,
	}
}

type AuthAccessTokenRepositoryJWTImpl struct {
	config         config.Config
	writableConfig config.WritableConfig
}

// JWTClaims represents the JWT claims for access token
type JWTClaims struct {
	UserID                   string `json:"user_id"`
	RelativeRefreshTokenHash string `json:"relative_refresh_token"`
	jwt.RegisteredClaims
}

// IssueAccessToken generates a new JWT access token for the given user
func (r *AuthAccessTokenRepositoryJWTImpl) IssueAccessToken(ctx context.Context, userID entity.UserIDEntity, relativeRefreshTokenHash string) (entity.AccessToken, error) {
	// calculate issue and expire time
	issueAt := utils.NowToSecond()
	ttl := utils.TTLInSecondToTimeDuration(r.config.AccessTokenTTL)
	expireAt := issueAt.Add(ttl)

	// create JWT claims
	claims := JWTClaims{
		UserID:                   string(userID),
		RelativeRefreshTokenHash: relativeRefreshTokenHash,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(issueAt),
			ExpiresAt: jwt.NewNumericDate(expireAt),
			Subject:   string(userID),
		},
	}

	// create JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// sign the token with secret
	tokenString, err := token.SignedString([]byte(r.writableConfig.Value.JWTSecret))
	if err != nil {
		return entity.AccessToken{}, errors.Wrap(err, "fail to sign JWT token")
	}

	// return the access token entity
	return entity.NewAccessToken(userID, tokenString, issueAt, expireAt, relativeRefreshTokenHash), nil
}

// ValidateAccessToken validates the given JWT token and returns the access token entity
// Returns error when token is expired, has invalid signature, or other JWT validation errors
func (r *AuthAccessTokenRepositoryJWTImpl) ValidateAccessToken(ctx context.Context, tokenString string) (entity.AccessToken, bool, error) {
	// parse and validate the JWT token
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(r.writableConfig.Value.JWTSecret), nil
	})

	if err != nil {
		logger.Errorf(ctx, "validate jwt fail: %v", err)
		// surface expired tokens as a soft failure flagged via the bool output
		// if errors.Is(err, jwt.ErrTokenExpired) {
		// 	return entity.AccessToken{}, false, nil
		// }
		// return error for invalid signature or other JWT validation errors
		// return entity.AccessToken{}, false, errors.Wrap(err, "fail to parse or validate JWT token")
		return entity.AccessToken{}, false, nil
	}

	// extract claims
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return entity.AccessToken{}, false, errors.New("invalid JWT claims body")
	}

	// check if token is expired (double check)
	if time.Now().After(claims.ExpiresAt.Time) {
		return entity.AccessToken{}, false, nil
	}

	// convert claims to entity
	accessToken := entity.NewAccessToken(
		entity.UserIDEntity(claims.UserID),
		tokenString,
		claims.IssuedAt.Time,
		claims.ExpiresAt.Time,
		claims.RelativeRefreshTokenHash,
	)

	return accessToken, true, nil
}

// DeleteAccessToken currently always succeeds because JWT access tokens are stateless.
func (r *AuthAccessTokenRepositoryJWTImpl) DeleteAccessToken(ctx context.Context, token entity.AccessToken) error {
	return nil
}

// DeleteAllTokensByUserID currently always succeeds because JWT access tokens are stateless.
func (r *AuthAccessTokenRepositoryJWTImpl) DeleteAllTokensByUserID(ctx context.Context, userID entity.UserIDEntity) error {
	return nil
}
