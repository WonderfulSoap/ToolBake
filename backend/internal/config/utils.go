package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/pkg/errors"
)

// GetEnvName get environment name, return value is one of: local, develop, staging, production
// if APP_ENV is empty, return empty string
func GetEnvName() string {

	envName := os.Getenv("APP_ENV")
	envName = strings.ToLower(envName)

	if envName == "" {
		return ""
	} else if envName == "local" {
		return "local"
	} else if envName == "development" || envName == "dev" || envName == "develop" {
		return "develop"
	} else if envName == "staging" || envName == "stg" {
		return "staging"
	} else if envName == "production" || envName == "prod" || envName == "prd" {
		return "production"
	} else if envName == "test" {
		return "test"
	} else {
		panic(errors.Errorf("invalid APP_ENV environment name: %s", envName))
	}
}

func getEnvFileName() string {
	envName := GetEnvName()
	if envName == "" {
		return ".env"
	}

	return fmt.Sprintf(".env.%s", envName)
}
