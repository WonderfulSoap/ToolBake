package migration

import (
	"context"
	"ya-tool-craft/internal/config"
	iRepository "ya-tool-craft/internal/domain/repository"

	"github.com/pkg/errors"
)

func NewRdsMigrationImpl(client iRepository.IRdsClient, config config.Config) *RdsMigrationImpl {
	return &RdsMigrationImpl{clienet: client, config: config}
}

type RdsMigrationImpl struct {
	clienet iRepository.IRdsClient
	config  config.Config
}

func (r *RdsMigrationImpl) RunMigrate(ctx context.Context) error {
	var schema string
	switch r.config.DBType {
	case "mysql":
		schema = mysqlSchema()
	default:
		schema = sqliteSchema()
	}

	db := r.clienet.DB()
	_, err := db.Exec(schema)
	if err != nil {
		return errors.Wrapf(err, "fail to migration tables")
	}
	return err
}

func sqliteSchema() string {
	return `
CREATE TABLE IF NOT EXISTS users (
	id VARCHAR(255) PRIMARY KEY,
	username VARCHAR(255) NOT NULL UNIQUE,
	email VARCHAR(255) UNIQUE,
	password_hash VARCHAR(255),
	roles TEXT NOT NULL,
	encrypt_key VARCHAR(255) NOT NULL,
	recovery_code TEXT,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at);

-- User SSO accounts table
CREATE TABLE IF NOT EXISTS user_sso (
	user_id VARCHAR(255) NOT NULL,
	provider VARCHAR(255) NOT NULL,
	provider_user_id VARCHAR(255) NOT NULL,
	provider_username VARCHAR(255),
	provider_email VARCHAR(255),
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sso_user_id ON user_sso (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sso_provider_user_id ON user_sso (provider, provider_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sso_user_id_provider ON user_sso (user_id, provider);

-- Tool table
CREATE TABLE IF NOT EXISTS tools (
	user_id VARCHAR(255) NOT NULL,
	id VARCHAR(255) NOT NULL,
	unique_id VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	namespace VARCHAR(255) NOT NULL,
	category VARCHAR(255) NOT NULL,
	is_activate BOOLEAN NOT NULL,
	realtime_execution BOOLEAN NOT NULL,
	ui_widgets TEXT NOT NULL,
	source TEXT NOT NULL,
	description TEXT NOT NULL,
	extra_info TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL,
	PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_tools_user_id ON tools (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_user_id_id ON tools (user_id, id);
CREATE INDEX IF NOT EXISTS idx_tools_unique_id ON tools (unique_id);

-- ToolsLastUpdateAt table
CREATE TABLE IF NOT EXISTS tools_last_update_at (
	user_id VARCHAR(255) PRIMARY KEY,
	last_updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tools_last_update_user_id ON tools_last_update_at (user_id);

-- Global script table
CREATE TABLE IF NOT EXISTS global_scripts (
	user_id VARCHAR(255) PRIMARY KEY,
	script TEXT NOT NULL,
	updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_global_scripts_user_id ON global_scripts (user_id);

-- User Passkeys table (WebAuthn)
CREATE TABLE IF NOT EXISTS user_passkeys (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id VARCHAR(255) NOT NULL,
	credential_id BLOB NOT NULL,
	public_key BLOB NOT NULL,
	sign_count INTEGER NOT NULL DEFAULT 0,
	aaguid BLOB,
	transports VARCHAR(255),
	device_name VARCHAR(255),
	extra_info TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL,
	last_used_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_passkeys_credential_id ON user_passkeys (credential_id);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user_id ON user_passkeys (user_id);

-- User 2FA table
CREATE TABLE IF NOT EXISTS user_2fa (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id VARCHAR(255) NOT NULL,
	type VARCHAR(50) NOT NULL,
	secret VARCHAR(255) NOT NULL,
	verified BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL,
	UNIQUE(user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_2fa_user_id_type ON user_2fa (user_id, type);
`
}

func mysqlSchema() string {
	return `
CREATE TABLE IF NOT EXISTS users (
	id VARCHAR(255) PRIMARY KEY,
	username VARCHAR(255) NOT NULL UNIQUE,
	email VARCHAR(255) UNIQUE,
	password_hash VARCHAR(255),
	roles TEXT NOT NULL,
	encrypt_key VARCHAR(255) NOT NULL,
	recovery_code TEXT,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sso (
	user_id VARCHAR(255) NOT NULL,
	provider VARCHAR(255) NOT NULL,
	provider_user_id VARCHAR(255) NOT NULL,
	provider_username VARCHAR(255),
	provider_email VARCHAR(255),
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL,
	INDEX idx_user_sso_user_id (user_id),
	UNIQUE INDEX idx_user_sso_provider_user_id (provider, provider_user_id),
	UNIQUE INDEX idx_user_sso_user_id_provider (user_id, provider)
);

CREATE TABLE IF NOT EXISTS tools (
	user_id VARCHAR(255) NOT NULL,
	id VARCHAR(255) NOT NULL,
	unique_id VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	namespace VARCHAR(255) NOT NULL,
	category VARCHAR(255) NOT NULL,
	is_activate BOOLEAN NOT NULL,
	realtime_execution BOOLEAN NOT NULL,
	ui_widgets TEXT NOT NULL,
	source TEXT NOT NULL,
	description TEXT NOT NULL,
	extra_info TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL,
	PRIMARY KEY (user_id, id),
	INDEX idx_tools_user_id (user_id),
	INDEX idx_tools_unique_id (unique_id)
);

CREATE TABLE IF NOT EXISTS tools_last_update_at (
	user_id VARCHAR(255) PRIMARY KEY,
	last_updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS global_scripts (
	user_id VARCHAR(255) PRIMARY KEY,
	script TEXT NOT NULL,
	updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS user_passkeys (
	id INT PRIMARY KEY AUTO_INCREMENT,
	user_id VARCHAR(255) NOT NULL,
	credential_id VARBINARY(255) NOT NULL,
	public_key BLOB NOT NULL,
	sign_count INT NOT NULL DEFAULT 0,
	aaguid VARBINARY(36),
	transports VARCHAR(255),
	device_name VARCHAR(255),
	extra_info TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL,
	last_used_at TIMESTAMP NULL,
	UNIQUE INDEX idx_user_passkeys_credential_id (credential_id),
	INDEX idx_user_passkeys_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS user_2fa (
	id INT PRIMARY KEY AUTO_INCREMENT,
	user_id VARCHAR(255) NOT NULL,
	type VARCHAR(50) NOT NULL,
	secret VARCHAR(255) NOT NULL,
	verified BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP NOT NULL,
	updated_at TIMESTAMP NOT NULL,
	UNIQUE INDEX idx_user_2fa_user_id_type (user_id, type),
	INDEX idx_user_2fa_user_id (user_id)
);
`
}
