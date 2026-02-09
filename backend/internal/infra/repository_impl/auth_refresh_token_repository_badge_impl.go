package repository_impl

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/utils"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/google/uuid"
	"github.com/pkg/errors"
)

func NewAuthRefreshTokenRepositoryBadgerImpl(config config.Config, client *client.BadgerClient) *AuthRefreshTokenRepositoryBadgerImpl {
	return &AuthRefreshTokenRepositoryBadgerImpl{
		config: config,
		client: *client,
	}
}

type AuthRefreshTokenRepositoryBadgerImpl struct {
	config config.Config
	client client.BadgerClient
}

// RefreshTokenModel represents the refresh token data stored in BadgerDB
type RefreshTokenModel struct {
	UserID    string    `json:"user_id"`
	Token     string    `json:"token"`
	TokenHash string    `json:"token_hash"`
	IssueAt   time.Time `json:"issue_at"`
	ExpireAt  time.Time `json:"expire_at"`
}

// IssueRefreshToken generates a new refresh token for the given user
func (r *AuthRefreshTokenRepositoryBadgerImpl) IssueRefreshToken(ctx context.Context, userID entity.UserIDEntity) (entity.RefreshToken, error) {
	// generate a unique token
	token := fmt.Sprintf("rt-%s", uuid.New().String())

	// calculate issue and expire time
	issueAt := utils.NowToSecond()
	ttl := utils.TTLInSecondToTimeDuration(r.config.RefreshTokenTTL)
	expireAt := issueAt.Add(ttl)

	refreshToken := entity.NewRefreshToken(userID, token, issueAt, expireAt)

	// create token model
	model := RefreshTokenModel{
		UserID:    string(refreshToken.UserID),
		Token:     refreshToken.Token,
		TokenHash: refreshToken.TokenHash,
		IssueAt:   refreshToken.IssueAt,
		ExpireAt:  refreshToken.ExpireAt,
	}

	// serialize to JSON
	data, err := json.Marshal(model)
	if err != nil {
		return entity.RefreshToken{}, errors.Wrap(err, "fail to marshal refresh token to json")
	}

	// store in BadgerDB with TTL
	err = r.client.DB.Update(func(txn *badger.Txn) error {
		entry := badger.NewEntry([]byte(refreshToken.TokenHash), data).WithTTL(ttl)
		return txn.SetEntry(entry)
	})
	if err != nil {
		return entity.RefreshToken{}, errors.Wrap(err, "fail to store refresh token to badger")
	}

	// return the refresh token entity
	return refreshToken, nil
}

// ValidateRefreshToken checks if the given token is valid and not expired
func (r *AuthRefreshTokenRepositoryBadgerImpl) ValidateRefreshToken(ctx context.Context, token string) (entity.RefreshToken, bool, error) {
	return r.ValidateRefreshTokenHash(ctx, utils.Sha256String(token))
}

// ValidateRefreshTokenHash validates an already hashed refresh token key
func (r *AuthRefreshTokenRepositoryBadgerImpl) ValidateRefreshTokenHash(ctx context.Context, tokenHash string) (entity.RefreshToken, bool, error) {
	var model RefreshTokenModel

	// retrieve from BadgerDB
	err := r.client.DB.View(func(txn *badger.Txn) error {
		item, err := txn.Get([]byte(tokenHash))
		if err != nil {
			return err
		}

		return item.Value(func(val []byte) error {
			return json.Unmarshal(val, &model)
		})
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// token not found or expired
			return entity.RefreshToken{}, false, nil
		}
		return entity.RefreshToken{}, false, errors.Wrap(err, "fail to retrieve refresh token from badger")
	}

	// check if token is expired (double check, BadgerDB TTL should handle this)
	if time.Now().After(model.ExpireAt) {
		return entity.RefreshToken{}, false, nil
	}

	// convert model to entity via factory to keep hashing logic centralized
	refreshToken := entity.NewRefreshToken(
		entity.UserIDEntity(model.UserID),
		model.Token,
		model.IssueAt,
		model.ExpireAt,
	)

	return refreshToken, true, nil
}

// DeleteRefreshToken removes the given token from storage
func (r *AuthRefreshTokenRepositoryBadgerImpl) DeleteRefreshToken(ctx context.Context, token string) error {
	tokenHash := utils.Sha256String(token)
	err := r.client.DB.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(tokenHash))
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// token already deleted or doesn't exist, not an error
			return nil
		}
		return errors.Wrap(err, "fail to delete refresh token from badger")
	}

	return nil
}

// DeleteRefreshTokenByHash removes the refresh token whose hash is already provided.
func (r *AuthRefreshTokenRepositoryBadgerImpl) DeleteRefreshTokenByHash(ctx context.Context, tokenHash string) error {
	err := r.client.DB.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(tokenHash))
	})

	if err != nil {
		if err == badger.ErrKeyNotFound {
			// token already deleted or doesn't exist, not an error
			return nil
		}
		return errors.Wrap(err, "fail to delete refresh token from badger")
	}

	return nil
}

// DeleteAllTokensByUserID removes all refresh tokens for the given user.
func (r *AuthRefreshTokenRepositoryBadgerImpl) DeleteAllTokensByUserID(ctx context.Context, userID entity.UserIDEntity) error {
	var keysToDelete [][]byte

	// first, collect all keys belonging to the user
	err := r.client.DB.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = true
		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			item := it.Item()
			err := item.Value(func(val []byte) error {
				var model RefreshTokenModel
				if err := json.Unmarshal(val, &model); err != nil {
					return nil // skip invalid entries
				}
				if model.UserID == string(userID) {
					keysToDelete = append(keysToDelete, append([]byte{}, item.Key()...))
				}
				return nil
			})
			if err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return errors.Wrap(err, "fail to iterate refresh tokens in badger")
	}

	// delete all collected keys
	for _, key := range keysToDelete {
		err := r.client.DB.Update(func(txn *badger.Txn) error {
			return txn.Delete(key)
		})
		if err != nil && err != badger.ErrKeyNotFound {
			return errors.Wrap(err, "fail to delete refresh token from badger")
		}
	}

	return nil
}
