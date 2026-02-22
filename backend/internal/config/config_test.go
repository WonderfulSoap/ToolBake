package config

import (
	"os"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewConfig(t *testing.T) {
	t.Run("should load config from environment variables", func(t *testing.T) {
		t.Setenv("LOG_FORMAT", "json")
		t.Setenv("LOG_LEVEL", "debug")
		t.Setenv("CACHE", "redis")
		t.Setenv("SQLLITE_PATH", "ignored.db")
		t.Setenv("MYSQL_HOST", "mysql.example.com")
		t.Setenv("MYSQL_PORT", "3307")
		t.Setenv("MYSQL_USER", "dbuser")
		t.Setenv("MYSQL_PASS", "dbpass")
		t.Setenv("MYSQL_DB", "db_prod")
		t.Setenv("REFRESH_TOKEN_TTL", "600")
		t.Setenv("ACCESS_TOKEN_TTL", "120")

		config, err := NewConfig()

		assert.NoError(t, err)
		assert.Equal(t, "json", config.LogFormat)
		assert.Equal(t, "debug", config.LogLevel)
		assert.Equal(t, "ignored.db", config.SqlitePath)
		assert.Equal(t, "mysql.example.com", config.MysqlHost)
		assert.Equal(t, "3307", config.MysqlPort)
		assert.Equal(t, "dbuser", config.MysqlUser)
		assert.Equal(t, "dbpass", config.MysqlPass)
		assert.Equal(t, "db_prod", config.MysqlDB)
		assert.Equal(t, uint64(600), config.RefreshTokenTTL)
		assert.Equal(t, uint64(120), config.AccessTokenTTL)
	})

	t.Run("should use default values when environment variables are not set", func(t *testing.T) {
		config, err := NewConfig()

		assert.NoError(t, err)
		assert.Equal(t, "text", config.LogFormat)
		assert.Equal(t, "info", config.LogLevel)
		assert.Equal(t, "data/sqlite.db", config.SqlitePath)
		assert.Equal(t, "", config.MysqlHost)
		assert.Equal(t, "", config.MysqlPort)
		assert.Equal(t, "", config.MysqlUser)
		assert.Equal(t, "", config.MysqlPass)
		assert.Equal(t, "", config.MysqlDB)
		assert.Equal(t, uint64(15778463), config.RefreshTokenTTL)
		assert.Equal(t, uint64(300), config.AccessTokenTTL)
		assert.True(t, config.ENABLE_USER_REGISTRATION)
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
	envContent := "LOG_LEVEL=warn\n"
	envPath := ".env.test"

	err := os.WriteFile(envPath, []byte(envContent), 0644)
	assert.NoError(t, err)
	t.Cleanup(func() {
		_ = os.Remove(envPath)
	})

	config, err := NewConfig()

	assert.NoError(t, err)
	assert.Equal(t, "warn", config.LogLevel)
}

func TestDumpEnvDefaultsMarkdownTable(t *testing.T) {
	c := Config{}
	table := c.DumpEnvDefaultsMarkdownTable()

	assert.Contains(t, table, "| ENV_NAME | defaultValue | supported value |")
	assert.Contains(t, table, "| FRONTEND_ASSET_PATH | ./frontend |  |")
	assert.Contains(t, table, "| DB_TYPE | sqlite | `sqlite`, `mysql` |")
	assert.Contains(t, table, "| MYSQL_HOST |  |  |")

	lineCount := len(strings.Split(strings.TrimSpace(table), "\n"))
	tagCount := 0
	cfgType := reflect.TypeOf(c)
	for i := 0; i < cfgType.NumField(); i++ {
		if cfgType.Field(i).Tag.Get("env") != "" {
			tagCount++
		}
	}

	// 2 table header lines + one line per env-tagged field.
	assert.Equal(t, tagCount+2, lineCount)
}
