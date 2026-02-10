package di

import (
	"ya-tool-craft/internal/application"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/domain/service"
	"ya-tool-craft/internal/infra/repository_impl"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/infra/repository_impl/migration"

	"github.com/pkg/errors"
	"go.uber.org/dig"
)

func InitDI() {
	// register Config into di container
	provide(config.NewConfig)
	provide(config.NewWritableConfig)

	// register controllers factories into di container
	for _, controllerFactory := range application.ControllerFactories() {
		// fmt.Println("registering controller factory: ", controllerFactory)
		if err := Container.Provide(controllerFactory, dig.Group("controllers")); err != nil {
			panic(errors.Errorf("failed to register controller factory into di container: %v", err))
		}
	}

	var c config.Config
	if err := Container.Invoke(func(cnf config.Config) { c = cnf }); err != nil {
		panic(errors.Errorf("failed to get config from di container: %v", err))
	}

	// provide rds client factory, and bind to IRdsClient by config
	// bind to IRdsClient
	repositoryBackendType := "rds"
	switch c.DBType {
	// disable duckdb because of cgo is awful
	// case "duckdb":
	// 	bind(client.NewDuckDBClient, new(repository.IRdsClient))
	// 	repositoryBackendType = "rds"
	case "sqlite":
		bind(client.NewSqliteClient, new(repository.IRdsClient))
		repositoryBackendType = "rds"
	case "mysql":
		bind(client.NewMysqlClient, new(repository.IRdsClient))
		repositoryBackendType = "rds"
	default:
		panic(errors.Errorf("invalid DBType in config: %s", c.DBType))
	}
	// provide migration, repository backend
	switch repositoryBackendType {
	case "rds":
		bind(migration.NewRdsMigrationImpl, new(repository.IMigration))
		bind(repository_impl.NewUserRepositoryRdsImpl, new(repository.IUserRepository))
		bind(repository_impl.NewToolRepositoryRdsImpl, new(repository.IToolRepository))
		bind(repository_impl.NewGlobalScriptRepositoryRdsImpl, new(repository.IGlobalScriptRepository))
		bind(repository_impl.NewPasskeyRepositoryRdsImpl, new(repository.IPasskeyRepository))
		bind(repository_impl.NewAuth2FARepositoryRdsImpl, new(repository.IAuth2FARepository))
	default:
		panic(errors.Errorf("unsupported repository backend type: %s", repositoryBackendType))
	}

	// provide key-value client factory by config
	if c.KeyValueDBType != "" {
		switch c.KeyValueDBType {
		// disable badger
		// case "badger":
		// 	provide(client.NewBadgerClient)
		// 	bind(repository_impl.NewCacheBadgerImpl, new(repository.ICache))
		// 	bind(repository_impl.NewAuthRefreshTokenRepositoryBadgerImpl, new(repository.IAuthRefreshTokenRepository))
		case "nutsdb":
			provide(client.NewNutsDBClient)
			bind(repository_impl.NewCacheNutsDBImpl, new(repository.ICache))
			bind(repository_impl.NewAuthRefreshTokenRepositoryNutsDBImpl, new(repository.IAuthRefreshTokenRepository))
		case "redis":
			// todo:
		case "rds":
			// todo:
		default:
			panic(errors.Errorf("invalid KeyValueDBType in config: %s", c.KeyValueDBType))
		}
	}

	// bind SSO clients to auth service interfaces
	bind(client.NewGithubClient, new(service.IGithubAuthClient))
	bind(client.NewGoogleClient, new(service.IGoogleAuthClient))

	infBinds := [][]any{
		{repository_impl.NewAuthAccessTokenRepositoryJWTImpl, new(repository.IAuthAccessTokenRepository)},
	}
	for _, bindInfo := range infBinds {
		bind(bindInfo[0], bindInfo[1])
	}

	factories := []any{
		service.NewAuthService,
		service.NewAuthPasskeyService,
		service.NewUserService,
		service.NewTwoFaService,
	}
	for _, factory := range factories {
		provide(factory)
	}

	provide(common.NewAccessTokenHeaderValidator)
}

func bind(factory any, interfaceType any) {
	if err := Container.Provide(factory, dig.As(interfaceType)); err != nil {
		panic(errors.Errorf("failed to bind to interface %T: %v", interfaceType, err))
	}
}

func provide(factory any) {
	if err := Container.Provide(factory); err != nil {
		panic(errors.Errorf("failed to provide factory %T into di container: %v", factory, err))
	}
}
