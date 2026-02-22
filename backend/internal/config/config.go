package config

import (
	"fmt"
	"reflect"
	"strings"
	"ya-tool-craft/internal/utils"

	"github.com/caarlos0/env/v11"
	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/pkg/errors"
)

type Config struct {
	FrontendAssetPath string `env:"FRONTEND_ASSET_PATH" envDefault:"./frontend"`

	Host string `env:"HOST" envDefault:"0.0.0.0:8080"`

	DBType     string `env:"DB_TYPE" envDefault:"sqlite" validate:"oneof=sqlite mysql"` // supports: sqlite, mysql
	DuckDBPath string `env:"DUCKDB_PATH" envDefault:"data/duckdb.db"`                   // also support "memory" for in-memory db
	SqlitePath string `env:"SQLLITE_PATH" envDefault:"data/sqlite.db"`                  // also support "memory" for in-memory db

	KeyValueDBType string `env:"KEY_VALUE_DB_TYPE" envDefault:"nutsdb" validate:"oneof=nutsdb redis rds"` // supports: badger, nutsdb, redis, rds
	BadgerPath     string `env:"BADGER_PATH" envDefault:"data/badger"`                                    // also support "memory" for in-memory db
	NutsDBPath     string `env:"NUTSDB_PATH" envDefault:"data/nutsdb"`

	RefreshTokenTTL uint64 `env:"REFRESH_TOKEN_TTL" envDefault:"15778463"`
	AccessTokenTTL  uint64 `env:"ACCESS_TOKEN_TTL" envDefault:"300"`

	ConfigFilePath string `env:"CONFIG_FILE_PATH" envDefault:"data/config.json"` // support memory

	LogFormat string `env:"LOG_FORMAT" envDefault:"text" validate:"oneof=text json"`            // supports: text, json
	LogLevel  string `env:"LOG_LEVEL" envDefault:"info" validate:"oneof=debug info warn error"` // supports: debug, info, warn, error
	// Cache     string `env:"CACHE" envDefault:"disabled" validate:"oneof=disabled memory redis mysql"` // supports: disabled, memory, redis, mysql

	SSO_GITHUB_CLIENT_ID     string `env:"SSO_GITHUB_CLIENT_ID" envDefault:""`
	SSO_GITHUB_CLIENT_SECRET string `env:"SSO_GITHUB_CLIENT_SECRET" envDefault:""`
	SSO_GITHUB_REDIRECT_URL  string `env:"SSO_GITHUB_REDIRECT_URL" envDefault:""`

	SSO_GOOGLE_CLIENT_ID     string `env:"SSO_GOOGLE_CLIENT_ID" envDefault:""`
	SSO_GOOGLE_CLIENT_SECRET string `env:"SSO_GOOGLE_CLIENT_SECRET" envDefault:""`
	SSO_GOOGLE_REDIRECT_URL  string `env:"SSO_GOOGLE_REDIRECT_URL" envDefault:""`

	ENABLE_PASSWORD_LOGIN     bool `env:"ENABLE_PASSWORD_LOGIN" envDefault:"false"`
	ENABLE_USER_REGISTRATION bool `env:"ENABLE_USER_REGISTRATION" envDefault:"true"`

	// WebAuthn Configuration
	WebAuthnRPName       string `env:"WEBAUTHN_RP_NAME" envDefault:"ToolBake-localhost"`
	WebAuthnRPID         string `env:"WEBAUTHN_RP_ID" envDefault:"localhost"`
	WebAuthnRPOrigin     string `env:"WEBAUTHN_RP_ORIGIN" envDefault:"http://localhost:8080"`
	WebAuthnChallengeTTL int    `env:"WEBAUTHN_CHALLENGE_TTL" envDefault:"300"` // seconds

	MysqlHost string `env:"MYSQL_HOST"`
	MysqlPort string `env:"MYSQL_PORT"`
	MysqlUser string `env:"MYSQL_USER"`
	MysqlPass string `env:"MYSQL_PASS"`
	MysqlDB   string `env:"MYSQL_DB"`

	// RedisHost     string `env:"REDIS_HOST" envDefault:""`
	// RedisPort     int    `env:"REDIS_PORT" envDefault:"6379"`
	// RedisPassword string `env:"REDIS_PASSWORD" envDefault:""`
}

func NewConfig() (Config, error) {
	c := Config{}

	if err := c.loadConfig(); err != nil {
		return Config{}, err
	}

	if err := c.Validate(); err != nil {
		return Config{}, err
	}

	return c, nil
}

// loadConfig load config from env file
func (c *Config) loadConfig() error {
	// load env file if exists
	envFilePath := getEnvFileName()

	// if env file exists, load it as env vars
	if utils.FileExists(envFilePath) {
		fmt.Printf("load config from env file: %s\n", envFilePath)
		err := godotenv.Load(envFilePath)
		if err != nil {
			return errors.Errorf("error happened when loading .env file '%s': %+v", envFilePath, err)
		}
	} else {
		fmt.Printf("env file '%s' not found, skip loading env file\n", envFilePath)
	}

	// parse env vars to config
	if err := env.Parse(c); err != nil {
		return errors.Errorf("error happened when parsing env vars: %+v", err)
	}

	c.debugPrintConfig()

	return nil
}

// debugPrintConfig prints all config fields using reflection, masking sensitive values.
func (c *Config) debugPrintConfig() {
	v := reflect.ValueOf(*c)
	t := v.Type()

	sensitiveKeys := map[string]bool{
		"SSO_GITHUB_CLIENT_SECRET": true,
		"SSO_GOOGLE_CLIENT_SECRET": true,
		"MysqlPass":                true,
		"RedisPassword":            true,
		"S3SecretKey":              true,
		"S3AccessKey":              true,
	}

	var sb strings.Builder
	sb.WriteString("========== Config ==========\n")
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		val := v.Field(i)
		display := fmt.Sprintf("%v", val.Interface())
		if sensitiveKeys[field.Name] && display != "" {
			display = "******"
		}
		sb.WriteString(fmt.Sprintf("  %-30s = %s\n", field.Name, display))
	}
	sb.WriteString("============================")
	fmt.Println(sb.String())
}

func (c Config) Validate() error {
	validate := validator.New(validator.WithRequiredStructEnabled())
	if err := validate.Struct(c); err != nil {
		return errors.Errorf("config validation failed, check your config or environment variables: %+v", err)
	}
	return nil
}

// DumpEnvDefaultsMarkdownTable returns config env tags as a markdown table.
func (c Config) DumpEnvDefaultsMarkdownTable() string {
	t := reflect.TypeOf(c)

	var sb strings.Builder
	sb.WriteString("| ENV_NAME | defaultValue | supported value |\n")
	sb.WriteString("| --- | --- | --- |\n")

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		envName := field.Tag.Get("env")
		if envName == "" || envName == "-" {
			continue
		}

		defaultValue := field.Tag.Get("envDefault")
		oneOf := formatSupportedValues(extractOneOfFromValidateTag(field.Tag.Get("validate")))
		sb.WriteString(fmt.Sprintf("| %s | %s | %s |\n",
			escapeMarkdownCell(envName),
			escapeMarkdownCell(defaultValue),
			oneOf,
		))
	}

	return sb.String()
}

func extractOneOfFromValidateTag(validateTag string) string {
	parts := strings.Split(validateTag, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "oneof=") {
			return strings.TrimPrefix(part, "oneof=")
		}
	}
	return ""
}

func formatSupportedValues(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}

	items := strings.Fields(value)
	for i, item := range items {
		items[i] = fmt.Sprintf("`%s`", item)
	}
	return strings.Join(items, ", ")
}

func escapeMarkdownCell(value string) string {
	value = strings.ReplaceAll(value, "|", "\\|")
	value = strings.ReplaceAll(value, "\n", "<br>")
	return value
}
