package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWritableConfigCreatesFileWithRandomSecret(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	cfg := Config{ConfigFilePath: filepath.Join(tempDir, "config.json")}
	t.Cleanup(func() { _ = os.Remove(cfg.ConfigFilePath) })

	wc := NewWritableConfig(cfg)

	require.NotEmpty(t, wc.Value.JWTSecret)
	require.FileExists(t, cfg.ConfigFilePath)

	var payload struct {
		JWTSecret string `json:"jwt_secret"`
	}
	data, err := os.ReadFile(cfg.ConfigFilePath)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(data, &payload))
	require.Equal(t, wc.Value.JWTSecret, payload.JWTSecret)
}

func TestWritableConfigLoadsExistingSecret(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	cfg := Config{ConfigFilePath: filepath.Join(tempDir, "config.json")}
	t.Cleanup(func() { _ = os.Remove(cfg.ConfigFilePath) })

	originalSecret := "existing-secret-value"
	payload := struct {
		JWTSecret string `json:"jwt_secret"`
	}{JWTSecret: originalSecret}

	data, err := json.Marshal(payload)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(cfg.ConfigFilePath, data, 0o600))

	wc := NewWritableConfig(cfg)
	require.Equal(t, originalSecret, wc.Value.JWTSecret)
}

func TestWritableConfigSetValuePersists(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	cfg := Config{ConfigFilePath: filepath.Join(tempDir, "config.json")}
	t.Cleanup(func() { _ = os.Remove(cfg.ConfigFilePath) })

	wc := NewWritableConfig(cfg)

	newSecret := "new-secret"
	require.NoError(t, wc.SetValue(&wc.Value.JWTSecret, newSecret))

	var payload struct {
		JWTSecret string `json:"jwt_secret"`
	}
	data, err := os.ReadFile(cfg.ConfigFilePath)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(data, &payload))
	require.Equal(t, newSecret, payload.JWTSecret)
}

func TestWritableConfigInMemoryMode(t *testing.T) {
	t.Parallel()

	cfg := Config{ConfigFilePath: "memory"}

	wc := NewWritableConfig(cfg)
	require.NotEmpty(t, wc.Value.JWTSecret)

	newSecret := "memory-secret"
	require.NoError(t, wc.SetValue(&wc.Value.JWTSecret, newSecret))

	_, err := os.Stat("memory")
	require.True(t, errors.Is(err, os.ErrNotExist))
	require.Equal(t, newSecret, wc.Value.JWTSecret)
}
