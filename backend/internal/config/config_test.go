package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewConfig(t *testing.T) {
	t.Run("should load config from environment variables", func(t *testing.T) {
		t.Setenv("LOG_FORMAT", "json")
		t.Setenv("LOG_LEVEL", "debug")
		t.Setenv("CACHE", "redis")
		t.Setenv("CACHE_REDIS_DB", "5")
		t.Setenv("SQL_TYPE", "mysql")
		t.Setenv("SQLLITE_PATH", "ignored.db")
		t.Setenv("MYSQL_HOST", "mysql.example.com")
		t.Setenv("MYSQL_PORT", "3307")
		t.Setenv("MYSQL_USER", "dbuser")
		t.Setenv("MYSQL_PASS", "dbpass")
		t.Setenv("MYSQL_DB", "db_prod")
		t.Setenv("REDIS_HOST", "redis.example.com")
		t.Setenv("REDIS_PORT", "6380")
		t.Setenv("REDIS_PASSWORD", "redispass")
		t.Setenv("FILE_STORAGE_TYPE", "s3")
		t.Setenv("S3_ENDPOINT", "https://s3.example.com")
		t.Setenv("S3_REGION", "eu-west-1")
		t.Setenv("S3_BUCKET", "test-bucket")
		t.Setenv("S3_ACCESS_KEY", "access_key")
		t.Setenv("S3_SECRET_KEY", "secret_key")
		t.Setenv("S3_FORCE_PATH_STYLE", "true")
		t.Setenv("OAUTH_TOKEN_BACKEND", "redis")
		t.Setenv("OAUTH_TOKEN_REDIS_BACKEND_DB", "9")
		t.Setenv("REFRESH_TOKEN_TTL", "600")
		t.Setenv("ACCESS_TOKEN_TTL", "120")

		config, err := NewConfig()

		assert.NoError(t, err)
		assert.Equal(t, "json", config.LogFormat)
		assert.Equal(t, "debug", config.LogLevel)
		assert.Equal(t, "redis", config.Cache)
		assert.Equal(t, 5, config.CacheRedisDB)
		assert.Equal(t, "ignored.db", config.SqlitePath)
		assert.Equal(t, "mysql.example.com", config.MysqlHost)
		assert.Equal(t, "3307", config.MysqlPort)
		assert.Equal(t, "dbuser", config.MysqlUser)
		assert.Equal(t, "dbpass", config.MysqlPass)
		assert.Equal(t, "db_prod", config.MysqlDB)
		assert.Equal(t, "redis.example.com", config.RedisHost)
		assert.Equal(t, 6380, config.RedisPort)
		assert.Equal(t, "redispass", config.RedisPassword)
		assert.Equal(t, "s3", config.FileStorageType)
		assert.Equal(t, "https://s3.example.com", config.S3Endpoint)
		assert.Equal(t, "eu-west-1", config.S3Region)
		assert.Equal(t, "test-bucket", config.S3Bucket)
		assert.Equal(t, "access_key", config.S3AccessKey)
		assert.Equal(t, "secret_key", config.S3SecretKey)
		assert.True(t, config.S3ForcePathStyle)
		assert.Equal(t, "redis", config.OAuthTokenBackend)
		assert.Equal(t, 9, config.OAuthTokenRedisBackendDB)
		assert.Equal(t, uint64(600), config.RefreshTokenTTL)
		assert.Equal(t, uint64(120), config.AccessTokenTTL)
	})

	t.Run("should use default values when environment variables are not set", func(t *testing.T) {
		config, err := NewConfig()

		assert.NoError(t, err)
		assert.Equal(t, "text", config.LogFormat)
		assert.Equal(t, "info", config.LogLevel)
		assert.Equal(t, "disabled", config.Cache)
		assert.Equal(t, 0, config.CacheRedisDB)
		assert.Equal(t, "data/sqlite.db", config.SqlitePath)
		assert.Equal(t, "", config.MysqlHost)
		assert.Equal(t, "", config.MysqlPort)
		assert.Equal(t, "", config.MysqlUser)
		assert.Equal(t, "", config.MysqlPass)
		assert.Equal(t, "", config.MysqlDB)
		assert.Equal(t, "", config.RedisHost)
		assert.Equal(t, 6379, config.RedisPort)
		assert.Equal(t, "", config.RedisPassword)
		assert.Equal(t, "local", config.FileStorageType)
		assert.Equal(t, "", config.S3Endpoint)
		assert.Equal(t, "us-east-1", config.S3Region)
		assert.Equal(t, "", config.S3Bucket)
		assert.Equal(t, "", config.S3AccessKey)
		assert.Equal(t, "", config.S3SecretKey)
		assert.False(t, config.S3ForcePathStyle)
		assert.Equal(t, "rds", config.OAuthTokenBackend)
		assert.Equal(t, 1, config.OAuthTokenRedisBackendDB)
		assert.Equal(t, uint64(31536000), config.RefreshTokenTTL)
		assert.Equal(t, uint64(3600), config.AccessTokenTTL)
	})

	t.Run("should return error when config validation fails", func(t *testing.T) {
		t.Setenv("LOG_LEVEL", "verbose")

		_, err := NewConfig()

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "LogLevel")
	})
}

func TestLoadConfigFromEnvFile(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	envContent := "LOG_LEVEL=warn\nFILE_STORAGE_TYPE=s3\nS3_BUCKET=env-file-bucket\nS3_FORCE_PATH_STYLE=true\n"
	envPath := ".env.test"

	err := os.WriteFile(envPath, []byte(envContent), 0644)
	assert.NoError(t, err)
	t.Cleanup(func() {
		_ = os.Remove(envPath)
	})

	config, err := NewConfig()

	assert.NoError(t, err)
	assert.Equal(t, "warn", config.LogLevel)
	assert.Equal(t, "s3", config.FileStorageType)
	assert.Equal(t, "env-file-bucket", config.S3Bucket)
	assert.True(t, config.S3ForcePathStyle)
}
