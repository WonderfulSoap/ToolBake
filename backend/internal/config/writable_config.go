package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

func NewWritableConfig(cfg Config) WritableConfig {
	wc := WritableConfig{config: cfg}

	if err := wc.init(); err != nil {
		panic(fmt.Errorf("failed to initialize writable config: %w", err))
	}

	return wc
}

type WritableConfig struct {
	config Config `json:"-"`

	Value struct {
		JWTSecret string `json:"jwt_secret"`
	}
}

func (w *WritableConfig) SetValue(field *string, value string) error {
	if field == nil {
		return errors.New("field cannot be nil")
	}

	*field = value
	return w.persist()
}

func (w *WritableConfig) init() error {
	if err := w.load(); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			w.Value.JWTSecret = generateJWTSecret()
			return w.persist()
		}
		return err
	}

	if w.Value.JWTSecret == "" {
		w.Value.JWTSecret = generateJWTSecret()
		return w.persist()
	}

	return nil
}

func (w *WritableConfig) load() error {
	if w.config.ConfigFilePath == "memory" {
		return os.ErrNotExist
	}

	data, err := os.ReadFile(w.config.ConfigFilePath)
	if err != nil {
		return err
	}

	if len(data) == 0 {
		return os.ErrNotExist
	}

	if err := json.Unmarshal(data, &w.Value); err != nil {
		return err
	}

	return nil
}

func (w *WritableConfig) persist() error {
	if w.config.ConfigFilePath == "memory" {
		return nil
	}

	data, err := json.MarshalIndent(w.Value, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(w.config.ConfigFilePath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}

	return os.WriteFile(w.config.ConfigFilePath, data, 0o600)
}

func generateJWTSecret() string {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		panic(fmt.Errorf("failed to generate jwt secret: %w", err))
	}

	return hex.EncodeToString(secret)
}
