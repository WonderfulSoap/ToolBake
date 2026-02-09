package healthcheck

import (
	"net/http"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/repository"

	_ "ya-tool-craft/internal/swagger"

	"github.com/gin-gonic/gin"
)

func NewHealthCheckController(config config.Config, migration repository.IMigration) router.Controller {
	return HealthCheckController{
		Migration: migration,
	}
}

type HealthCheckController struct {
	common.JsonResponse

	Migration repository.IMigration
}

func (c HealthCheckController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{
		{Method: http.MethodGet, Path: "/api/v1/healthcheck", Handler: c.Login},
	}
}

// @Summary		Health check
// @Description	Verify that the service is up
// @Tags			Maintenance
// @Accept			json
// @Produce		json
// @Success		200	{object}	swagger.BaseSuccessResponse[any]
// @Failure		400	{object}	swagger.BaseFailResponse
// @Router			/api/v1/healthcheck [get]
func (c *HealthCheckController) Login(ctx *gin.Context) {
	logger.Info(ctx, "Enter!!")
	logger.Infof(ctx, "Login")

	c.Success(ctx, "server is running", nil)
}
