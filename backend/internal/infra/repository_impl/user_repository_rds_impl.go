package repository_impl

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	"github.com/google/uuid"
	"github.com/pkg/errors"
	"github.com/samber/lo"
	"golang.org/x/crypto/bcrypt"
)

// UserRdsModel represents the user table structure in RDS
type UserRdsModel struct {
	ID           string         `db:"id"`
	Username     string         `db:"username"`
	Email        sql.NullString `db:"email"`
	PasswordHash sql.NullString `db:"password_hash"`
	Roles        string         `db:"roles"`       // stored as JSON string
	EncryptKey   string         `db:"encrypt_key"` // encryption key for user data
	RecoveryCode sql.NullString `db:"recovery_code"`
	CreatedAt    time.Time      `db:"created_at"`
	UpdatedAt    time.Time      `db:"updated_at"`
}

// UserSSORdsModel represents the user_sso table structure in RDS
type UserSSORdsModel struct {
	UserID           string         `db:"user_id"`
	Provider         string         `db:"provider"`
	ProviderUserID   string         `db:"provider_user_id"`
	ProviderUsername sql.NullString `db:"provider_username"`
	ProviderEmail    sql.NullString `db:"provider_email"`
	CreatedAt        time.Time      `db:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at"`
}

func NewUserRepositoryRdsImpl(config config.Config, client repository.IRdsClient) *UserRepositoryRdsImpl {
	return &UserRepositoryRdsImpl{config: config, client: client}
}

type UserRepositoryRdsImpl struct {
	config config.Config
	client repository.IRdsClient
}

func (r *UserRepositoryRdsImpl) Create(ctx context.Context, username string, roles []entity.UserRoleEntity) (entity.UserEntity, error) {
	now := time.Now()
	db := r.client.DB()

	// user role json
	rolesString := lo.Map(roles, func(item entity.UserRoleEntity, idx int) string { return item.RoleName })
	rolesJSON, err := json.Marshal(rolesString)
	if err != nil {
		return entity.UserEntity{}, errors.Wrap(err, "fail to convert user roles to json string")
	}

	// encrypt key
	encryKey := fmt.Sprintf("encry-key-%s", uuid.New().String())

	// generate a new user uuid
	userID := fmt.Sprintf("u-%s", uuid.New().String())
	_, err = db.Exec("INSERT INTO users (id, username, roles, encrypt_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", userID, username, string(rolesJSON), encryKey, now, now)
	if err != nil {
		return entity.UserEntity{}, errors.Wrap(err, "fail to insert user into rds")
	}

	// return created user entity
	return entity.NewUserEntity(
		entity.UserIDEntity(userID),
		username,
		nil, // email is empty for now
		nil, // password hash is empty for now
		roles,
		encryKey,
	), nil
}

// GetByID retrieves a user by ID
func (r *UserRepositoryRdsImpl) GetByID(ctx context.Context, id entity.UserIDEntity) (entity.UserEntity, bool, error) {
	db := r.client.DB()
	var model UserRdsModel

	err := db.Get(&model, "SELECT * FROM users WHERE id = ?", string(id))
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.UserEntity{}, false, nil
		}
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by id from rds")
	}

	user, err := r.toEntity(&model)
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to convert rds model to entity")
	}

	return user, true, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepositoryRdsImpl) GetByEmail(ctx context.Context, email string) (entity.UserEntity, bool, error) {
	db := r.client.DB()
	var model UserRdsModel

	err := db.Get(&model, "SELECT * FROM users WHERE email = ?", email)
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.UserEntity{}, false, nil
		}
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by email from rds")
	}

	user, err := r.toEntity(&model)
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to convert rds model to entity")
	}

	return user, true, nil
}

// GetByUsername retrieves a user by username
func (r *UserRepositoryRdsImpl) GetByUsername(ctx context.Context, username string) (entity.UserEntity, bool, error) {
	db := r.client.DB()
	var model UserRdsModel

	err := db.Get(&model, "SELECT * FROM users WHERE username = ?", username)
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.UserEntity{}, false, nil
		}
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by username from rds")
	}

	user, err := r.toEntity(&model)
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to convert rds model to entity")
	}

	return user, true, nil
}

// Update updates user information
func (r *UserRepositoryRdsImpl) Update(ctx context.Context, user entity.UserEntity) error {
	db := r.client.DB()
	now := time.Now()

	// convert roles to JSON
	roleNames := lo.Map(user.Roles, func(item entity.UserRoleEntity, idx int) string { return item.RoleName })
	rolesJSON, err := json.Marshal(roleNames)
	if err != nil {
		return errors.Wrap(err, "fail to convert user roles to json string")
	}

	// convert *string to sql.NullString
	email := sql.NullString{}
	if user.Mail != nil {
		email.String = *user.Mail
		email.Valid = true
	}

	passwordHash := sql.NullString{}
	if user.PasswordHash != nil {
		passwordHash.String = *user.PasswordHash
		passwordHash.Valid = true
	}

	// Note: encrypt_key is not updated here, it can only be set during user creation
	_, err = db.Exec(
		"UPDATE users SET username = ?, email = ?, password_hash = ?, roles = ?, updated_at = ? WHERE id = ?",
		user.Name, email, passwordHash, string(rolesJSON), now, string(user.ID),
	)
	if err != nil {
		return errors.Wrap(err, "fail to update user in rds")
	}

	return nil
}

// Delete deletes a user
func (r *UserRepositoryRdsImpl) Delete(ctx context.Context, id entity.UserIDEntity) error {
	db := r.client.DB()

	_, err := db.Exec("DELETE FROM users WHERE id = ?", string(id))
	if err != nil {
		return errors.Wrap(err, "fail to delete user from rds")
	}

	return nil
}

// UpdatePassword updates user's password
func (r *UserRepositoryRdsImpl) UpdatePassword(ctx context.Context, id entity.UserIDEntity, newPassword string) error {
	db := r.client.DB()
	now := time.Now()

	// hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.Wrap(err, "fail to hash password")
	}

	_, err = db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
		string(hashedPassword), now, string(id),
	)
	if err != nil {
		return errors.Wrap(err, "fail to update password in rds")
	}

	return nil
}

// ValidateCredentialsByUsername validates username and password combination
func (r *UserRepositoryRdsImpl) ValidateCredentialsByUsername(ctx context.Context, username string, password string) (entity.UserEntity, bool, error) {
	user, found, err := r.GetByUsername(ctx, username)
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by username")
	}
	if !found {
		return entity.UserEntity{}, false, nil
	}

	// validate password
	if user.PasswordHash == nil {
		return entity.UserEntity{}, false, nil
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password))
	if err != nil {
		return entity.UserEntity{}, false, nil
	}

	return user, true, nil
}

// ValidateCredentialsByEmail validates email and password combination
func (r *UserRepositoryRdsImpl) ValidateCredentialsByEmail(ctx context.Context, email string, password string) (entity.UserEntity, bool, error) {
	user, found, err := r.GetByEmail(ctx, email)
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by email")
	}
	if !found {
		return entity.UserEntity{}, false, nil
	}

	// validate password
	if user.PasswordHash == nil {
		return entity.UserEntity{}, false, nil
	}

	err = bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password))
	if err != nil {
		return entity.UserEntity{}, false, nil
	}

	return user, true, nil
}

// CreateUserBySSO creates a new user and user sso binding
func (r *UserRepositoryRdsImpl) CreateUserBySSO(ctx context.Context, provider string, providerUserID string, providerUsername *string, providerEmail *string, roles []entity.UserRoleEntity) (entity.UserEntity, error) {
	db := r.client.DB()
	now := time.Now()

	usernameValue := ""
	if providerUsername != nil {
		usernameValue = *providerUsername
	}
	if usernameValue == "" {
		usernameValue = fmt.Sprintf("User-%s", uuid.New().String())
	}

	user, err := r.Create(ctx, usernameValue, roles)
	if err != nil {
		return entity.UserEntity{}, errors.Wrap(err, "fail to create user by sso")
	}

	username := sql.NullString{}
	if providerUsername != nil {
		username.String = *providerUsername
		username.Valid = true
	}

	email := sql.NullString{}
	if providerEmail != nil {
		email.String = *providerEmail
		email.Valid = true
	}

	_, err = db.Exec(
		"INSERT INTO user_sso (user_id, provider, provider_user_id, provider_username, provider_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		string(user.ID), provider, providerUserID, username, email, now, now,
	)
	if err != nil {
		return entity.UserEntity{}, errors.Wrap(err, "fail to insert user sso into rds")
	}

	return user, nil
}

// GetUserBySSO retrieves a user by provider and provider user id
func (r *UserRepositoryRdsImpl) GetUserBySSO(ctx context.Context, provider string, providerUserID string) (user entity.UserEntity, userExists bool, err error) {
	db := r.client.DB()
	var model UserSSORdsModel

	err = db.Get(&model, "SELECT * FROM user_sso WHERE provider = ? AND provider_user_id = ?", provider, providerUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return entity.UserEntity{}, false, nil
		}
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user sso by provider user id from rds")
	}

	user, found, err := r.GetByID(ctx, entity.UserIDEntity(model.UserID))
	if err != nil {
		return entity.UserEntity{}, false, errors.Wrap(err, "fail to get user by id from rds for sso")
	}
	if !found {
		return entity.UserEntity{}, false, nil
	}

	return user, true, nil
}

// GetUserSSOBindings retrieves all SSO bindings for a user
func (r *UserRepositoryRdsImpl) GetUserSSOBindings(ctx context.Context, userID entity.UserIDEntity) ([]entity.UserSSOEntity, error) {
	db := r.client.DB()
	var models []UserSSORdsModel

	err := db.Select(&models, "SELECT * FROM user_sso WHERE user_id = ? ORDER BY created_at ASC", string(userID))
	if err != nil {
		return nil, errors.Wrap(err, "fail to get user sso bindings from rds")
	}

	ssos := make([]entity.UserSSOEntity, 0, len(models))
	for _, model := range models {
		modelCopy := model
		sso, err := r.toUserSSOEntity(&modelCopy)
		if err != nil {
			return nil, errors.Wrap(err, "fail to convert rds model to sso entity")
		}
		ssos = append(ssos, sso)
	}

	return ssos, nil
}

// toEntity converts UserRdsModel to UserEntity
func (r *UserRepositoryRdsImpl) toEntity(model *UserRdsModel) (entity.UserEntity, error) {
	// parse roles from JSON
	var roleNames []string
	err := json.Unmarshal([]byte(model.Roles), &roleNames)
	if err != nil {
		return entity.UserEntity{}, errors.Wrap(err, "convert user model to entity failL: fail to unmarshal roles from json")
	}

	roles := lo.Map(roleNames, func(name string, idx int) entity.UserRoleEntity {
		return entity.UserRoleEntity{RoleName: name}
	})

	// convert sql.NullString to *string
	var email *string
	if model.Email.Valid {
		email = &model.Email.String
	}

	var passwordHash *string
	if model.PasswordHash.Valid {
		passwordHash = &model.PasswordHash.String
	}

	return entity.NewUserEntity(
		entity.UserIDEntity(model.ID),
		model.Username,
		email,
		passwordHash,
		roles,
		model.EncryptKey,
	), nil
}

func (r *UserRepositoryRdsImpl) toUserSSOEntity(model *UserSSORdsModel) (entity.UserSSOEntity, error) {
	var username *string
	if model.ProviderUsername.Valid {
		username = &model.ProviderUsername.String
	}

	var email *string
	if model.ProviderEmail.Valid {
		email = &model.ProviderEmail.String
	}

	return entity.NewUserSSOEntity(
		entity.UserIDEntity(model.UserID),
		model.Provider,
		model.ProviderUserID,
		username,
		email,
		model.CreatedAt,
		model.UpdatedAt,
	), nil
}

// AddUserSSOBinding adds a new user sso binding
func (r *UserRepositoryRdsImpl) AddUserSSOBinding(ctx context.Context, userID entity.UserIDEntity, provider string, providerUserID string, providerUsername *string, providerEmail *string) error {
	db := r.client.DB()
	now := time.Now()

	username := sql.NullString{}
	if providerUsername != nil {
		username.String = *providerUsername
		username.Valid = true
	}

	email := sql.NullString{}
	if providerEmail != nil {
		email.String = *providerEmail
		email.Valid = true
	}

	_, err := db.Exec(
		"INSERT INTO user_sso (user_id, provider, provider_user_id, provider_username, provider_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		string(userID), provider, providerUserID, username, email, now, now,
	)
	if err != nil {
		return errors.Wrap(err, "fail to insert user sso binding into rds")
	}

	return nil
}

// DeleteUserSSOBinding deletes a user sso binding by provider
func (r *UserRepositoryRdsImpl) DeleteUserSSOBinding(ctx context.Context, userID entity.UserIDEntity, provider string) error {
	db := r.client.DB()

	_, err := db.Exec("DELETE FROM user_sso WHERE user_id = ? AND provider = ?", string(userID), provider)
	if err != nil {
		return errors.Wrap(err, "fail to delete user sso binding from rds")
	}

	return nil
}

// DeleteUserWithAllData deletes a user and all related data in a single transaction
func (r *UserRepositoryRdsImpl) DeleteUserWithAllData(ctx context.Context, id entity.UserIDEntity) error {
	db := r.client.DB()
	tx, err := db.Beginx()
	if err != nil {
		return errors.Wrap(err, "fail to begin delete user transaction")
	}

	userIDStr := string(id)

	// Delete user SSO bindings
	if _, err := tx.Exec("DELETE FROM user_sso WHERE user_id = ?", userIDStr); err != nil {
		tx.Rollback()
		return errors.Wrap(err, "fail to delete user sso bindings")
	}

	// Delete user tools
	if _, err := tx.Exec("DELETE FROM tools WHERE user_id = ?", userIDStr); err != nil {
		tx.Rollback()
		return errors.Wrap(err, "fail to delete user tools")
	}

	// Delete user tools last update timestamp
	if _, err := tx.Exec("DELETE FROM tools_last_update_at WHERE user_id = ?", userIDStr); err != nil {
		tx.Rollback()
		return errors.Wrap(err, "fail to delete user tools last update timestamp")
	}

	// Delete user global scripts
	if _, err := tx.Exec("DELETE FROM global_scripts WHERE user_id = ?", userIDStr); err != nil {
		tx.Rollback()
		return errors.Wrap(err, "fail to delete user global scripts")
	}

	// Delete user record
	if _, err := tx.Exec("DELETE FROM users WHERE id = ?", userIDStr); err != nil {
		tx.Rollback()
		return errors.Wrap(err, "fail to delete user")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "fail to commit delete user transaction")
	}

	return nil
}
