package engine

import (
	"context"
	"fmt"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/di"
	"ya-tool-craft/internal/domain/repository"
	"ya-tool-craft/internal/middleware"
	"ya-tool-craft/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pkg/errors"
	"go.uber.org/dig"
)

type Engine struct {
	ginEngine *gin.Engine

	config    config.Config
	migration repository.IMigration
}

func NewEngine() *Engine {
	envName := config.GetEnvName()
	if envName != "test" && envName != "local" {
		gin.SetMode(gin.ReleaseMode)
	}

	e := &Engine{
		ginEngine: gin.Default(),
	}
	e.init()

	return e
}

func (e *Engine) init() {
	di.InitDI()

	var c config.Config
	var migration repository.IMigration
	if err := di.Container.Invoke(func(cnf config.Config, m repository.IMigration) {
		c = cnf
		migration = m
	}); err != nil {
		panic(errors.Errorf("failed to get config from di container: %v", err))
	}
	e.config = c
	e.migration = migration
	logger.InitLogger(c)

	// register middleware
	e.ginEngine.Use(middleware.RequestIDMiddlewareFactory())
	e.ginEngine.Use(middleware.RequestInfoMiddlewareFactory(c))
	if gin.Mode() == gin.DebugMode {
		e.ginEngine.Use(middleware.DebugCORSMiddleware())
	}

	e.registerController()

}

func (e *Engine) registerController() {
	// get controllers from di container
	type ControllerFactoryParams struct {
		dig.In
		Controllers []router.Controller `group:"controllers"`
	}
	err := di.Container.Invoke(func(c ControllerFactoryParams) {
		// fmt.Println(c.Controllers)
		// get router infos and register to gin engine
		for _, controller := range c.Controllers {
			// Check if this is a NoRoute controller
			if noRouteController, ok := controller.(router.NoRouteController); ok {
				e.ginEngine.NoRoute(noRouteController.NoRouteHandler())
				continue
			}

			routerInfos := controller.RouterInfo()
			for _, routerInfo := range routerInfos {
				handlers := append(routerInfo.Middlewares, routerInfo.Handler)
				e.ginEngine.Handle(routerInfo.Method, routerInfo.Path, handlers...)
			}
		}
	})
	if err != nil {
		panic(errors.Errorf("failed to get registerd controllers from di container: %v", err))
	}

}

func (e *Engine) Run() error {
	host := e.config.Host
	if utils.StringRemoveAllSpace(host) == "" {
		host = "0.0.0.0:8080"
	}
	return e.ginEngine.Run(host)
}

func (e *Engine) RunDBMigration() error {
	ctx := utils.NewValueContext(context.Background())
	ctx.Set("x-request-id", uuid.New().String())
	ctx.Set("request-start-time", time.Now())

	logger.Info(ctx, "starting database migration")
	if err := e.migration.RunMigrate(ctx); err != nil {
		return errors.Wrap(err, "migration failed")
	}

	logger.Info(ctx, "migration completed successfully")
	fmt.Println("migration completed successfully")
	return nil
}
