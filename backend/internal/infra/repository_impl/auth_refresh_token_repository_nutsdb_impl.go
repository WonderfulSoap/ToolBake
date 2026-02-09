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

	"github.com/google/uuid"
	"github.com/nutsdb/nutsdb"
	"github.com/pkg/errors"
)

const (
	nutsdbRefreshTokenBucket      = "refresh_token"
	nutsdbRefreshTokenUserBucket  = "refresh_token_user"
)

func NewAuthRefreshTokenRepositoryNutsDBImpl(config config.Config, client *client.NutsDBClient) *AuthRefreshTokenRepositoryNutsDBImpl {
	// ensure buckets exist
	if err := client.DB.Update(func(tx *nutsdb.Tx) error {
		if !tx.ExistBucket(nutsdb.DataStructureBTree, nutsdbRefreshTokenBucket) {
			if err := tx.NewBucket(nutsdb.DataStructureBTree, nutsdbRefreshTokenBucket); err != nil {
				return err
			}
		}
		if !tx.ExistBucket(nutsdb.DataStructureSet, nutsdbRefreshTokenUserBucket) {
			if err := tx.NewBucket(nutsdb.DataStructureSet, nutsdbRefreshTokenUserBucket); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		panic(errors.Wrap(err, "failed to create nutsdb refresh_token buckets"))
	}

	return &AuthRefreshTokenRepositoryNutsDBImpl{
		config: config,
		client: *client,
	}
}

type AuthRefreshTokenRepositoryNutsDBImpl struct {
	config config.Config
	client client.NutsDBClient
}

// IssueRefreshToken generates a new refresh token for the given user
func (r *AuthRefreshTokenRepositoryNutsDBImpl) IssueRefreshToken(ctx context.Context, userID entity.UserIDEntity) (entity.RefreshToken, error) {
	token := fmt.Sprintf("rt-%s", uuid.New().String())

	issueAt := utils.NowToSecond()
	ttl := utils.TTLInSecondToTimeDuration(r.config.RefreshTokenTTL)
	expireAt := issueAt.Add(ttl)

	refreshToken := entity.NewRefreshToken(userID, token, issueAt, expireAt)

	model := RefreshTokenModel{
		UserID:    string(refreshToken.UserID),
		Token:     refreshToken.Token,
		TokenHash: refreshToken.TokenHash,
		IssueAt:   refreshToken.IssueAt,
		ExpireAt:  refreshToken.ExpireAt,
	}

	data, err := json.Marshal(model)
	if err != nil {
		return entity.RefreshToken{}, errors.Wrap(err, "fail to marshal refresh token to json")
	}

	err = r.client.DB.Update(func(tx *nutsdb.Tx) error {
		if err := tx.Put(nutsdbRefreshTokenBucket, []byte(refreshToken.TokenHash), data, uint32(r.config.RefreshTokenTTL)); err != nil {
			return err
		}
		// store token hash in user's set for fast lookup by userID
		return tx.SAdd(nutsdbRefreshTokenUserBucket, []byte(string(userID)), []byte(refreshToken.TokenHash))
	})
	if err != nil {
		return entity.RefreshToken{}, errors.Wrap(err, "fail to store refresh token to nutsdb")
	}

	go r.CleanupExpiredTokenHashesForUser(ctx, userID)

	return refreshToken, nil
}

// ValidateRefreshToken checks if the given token is valid and not expired
func (r *AuthRefreshTokenRepositoryNutsDBImpl) ValidateRefreshToken(ctx context.Context, token string) (entity.RefreshToken, bool, error) {
	return r.ValidateRefreshTokenHash(ctx, utils.Sha256String(token))
}

// ValidateRefreshTokenHash validates an already hashed refresh token key
func (r *AuthRefreshTokenRepositoryNutsDBImpl) ValidateRefreshTokenHash(ctx context.Context, tokenHash string) (entity.RefreshToken, bool, error) {
	var model RefreshTokenModel

	err := r.client.DB.View(func(tx *nutsdb.Tx) error {
		val, err := tx.Get(nutsdbRefreshTokenBucket, []byte(tokenHash))
		if err != nil {
			return err
		}
		return json.Unmarshal(val, &model)
	})

	if err != nil {
		if nutsdb.IsKeyNotFound(err) || nutsdb.IsBucketNotFound(err) {
			return entity.RefreshToken{}, false, nil
		}
		return entity.RefreshToken{}, false, errors.Wrap(err, "fail to retrieve refresh token from nutsdb")
	}

	// check if token is expired (double check, NutsDB TTL should handle this)
	if time.Now().After(model.ExpireAt) {
		return entity.RefreshToken{}, false, nil
	}

	refreshToken := entity.NewRefreshToken(
		entity.UserIDEntity(model.UserID),
		model.Token,
		model.IssueAt,
		model.ExpireAt,
	)

	return refreshToken, true, nil
}

// DeleteRefreshToken removes the given token from storage
func (r *AuthRefreshTokenRepositoryNutsDBImpl) DeleteRefreshToken(ctx context.Context, token string) error {
	tokenHash := utils.Sha256String(token)
	return r.DeleteRefreshTokenByHash(ctx, tokenHash)
}

// DeleteRefreshTokenByHash removes the refresh token whose hash is already provided.
func (r *AuthRefreshTokenRepositoryNutsDBImpl) DeleteRefreshTokenByHash(ctx context.Context, tokenHash string) error {
	// look up userID first so we can remove from the user's set
	var userID string
	_ = r.client.DB.View(func(tx *nutsdb.Tx) error {
		val, err := tx.Get(nutsdbRefreshTokenBucket, []byte(tokenHash))
		if err != nil {
			return err
		}
		var model RefreshTokenModel
		if err := json.Unmarshal(val, &model); err != nil {
			return err
		}
		userID = model.UserID
		return nil
	})

	err := r.client.DB.Update(func(tx *nutsdb.Tx) error {
		_ = tx.Delete(nutsdbRefreshTokenBucket, []byte(tokenHash))
		if userID != "" {
			_ = tx.SRem(nutsdbRefreshTokenUserBucket, []byte(userID), []byte(tokenHash))
		}
		return nil
	})

	if err != nil {
		if nutsdb.IsKeyNotFound(err) || nutsdb.IsBucketNotFound(err) {
			return nil
		}
		return errors.Wrap(err, "fail to delete refresh token from nutsdb")
	}

	if userID != "" {
		go r.CleanupExpiredTokenHashesForUser(ctx, entity.UserIDEntity(userID))
	}

	return nil
}

// DeleteAllTokensByUserID removes all refresh tokens for the given user.
func (r *AuthRefreshTokenRepositoryNutsDBImpl) DeleteAllTokensByUserID(ctx context.Context, userID entity.UserIDEntity) error {
	var tokenHashes [][]byte

	// get all token hashes from the user's set
	err := r.client.DB.View(func(tx *nutsdb.Tx) error {
		members, err := tx.SMembers(nutsdbRefreshTokenUserBucket, []byte(string(userID)))
		if err != nil {
			return err
		}
		tokenHashes = members
		return nil
	})

	if err != nil {
		if nutsdb.IsBucketNotFound(err) || nutsdb.IsBucketEmpty(err) || nutsdb.IsKeyNotFound(err) || err.Error() == "set not exist" {
			return nil
		}
		return errors.Wrap(err, "fail to get user token hashes from nutsdb")
	}

	// delete all token entries and clear the user's set
	return r.client.DB.Update(func(tx *nutsdb.Tx) error {
		for _, hash := range tokenHashes {
			_ = tx.Delete(nutsdbRefreshTokenBucket, hash)
		}
		_ = tx.SRem(nutsdbRefreshTokenUserBucket, []byte(string(userID)), tokenHashes...)
		return nil
	})
}

// CleanupExpiredTokenHashesForUser removes stale entries from the user's token hash set.
// It checks each token hash in the set; if the corresponding refresh token is expired or
// no longer exists, the hash is removed from the set.
func (r *AuthRefreshTokenRepositoryNutsDBImpl) CleanupExpiredTokenHashesForUser(ctx context.Context, userID entity.UserIDEntity) error {
	var tokenHashes [][]byte

	err := r.client.DB.View(func(tx *nutsdb.Tx) error {
		members, err := tx.SMembers(nutsdbRefreshTokenUserBucket, []byte(string(userID)))
		if err != nil {
			return err
		}
		tokenHashes = members
		return nil
	})

	if err != nil {
		if nutsdb.IsBucketNotFound(err) || nutsdb.IsBucketEmpty(err) || nutsdb.IsKeyNotFound(err) || err.Error() == "set not exist" {
			return nil
		}
		return errors.Wrap(err, "fail to get user token hashes from nutsdb")
	}

	var staleHashes [][]byte

	err = r.client.DB.View(func(tx *nutsdb.Tx) error {
		for _, hash := range tokenHashes {
			if _, err := tx.Get(nutsdbRefreshTokenBucket, hash); err != nil {
				staleHashes = append(staleHashes, hash)
			}
		}
		return nil
	})

	if err != nil {
		return errors.Wrap(err, "fail to check token hashes in nutsdb")
	}

	if len(staleHashes) == 0 {
		return nil
	}

	return r.client.DB.Update(func(tx *nutsdb.Tx) error {
		return tx.SRem(nutsdbRefreshTokenUserBucket, []byte(string(userID)), staleHashes...)
	})
}
