package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetEnvName(t *testing.T) {
	tests := []struct {
		name     string
		appEnv   string
		expected string
	}{
		{"empty returns empty", "", ""},
		{"local", "local", "local"},
		{"development", "development", "develop"},
		{"dev", "dev", "develop"},
		{"develop", "develop", "develop"},
		{"staging", "staging", "staging"},
		{"stg", "stg", "staging"},
		{"production", "production", "production"},
		{"prod", "prod", "production"},
		{"prd", "prd", "production"},
		{"test", "test", "test"},
		{"case insensitive", "PRODUCTION", "production"},
		{"mixed case", "Staging", "staging"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("APP_ENV", tt.appEnv)
			assert.Equal(t, tt.expected, GetEnvName())
		})
	}

	t.Run("invalid env name panics", func(t *testing.T) {
		t.Setenv("APP_ENV", "invalid")
		assert.Panics(t, func() {
			GetEnvName()
		})
	})
}

func TestGetEnvFileName(t *testing.T) {
	tests := []struct {
		name     string
		appEnv   string
		expected string
	}{
		{"empty returns .env", "", ".env"},
		{"local", "local", ".env.local"},
		{"develop", "dev", ".env.develop"},
		{"staging", "stg", ".env.staging"},
		{"production", "prod", ".env.production"},
		{"test", "test", ".env.test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("APP_ENV", tt.appEnv)
			assert.Equal(t, tt.expected, getEnvFileName())
		})
	}
}
