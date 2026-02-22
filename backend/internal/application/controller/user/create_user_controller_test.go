package user

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCreateUserController_Create_RegistrationDisabled(t *testing.T) {
	t.Parallel()
	gin.SetMode(gin.TestMode)
	logger.InitLogger(config.Config{
		LogLevel:  "error",
		LogFormat: "text",
	})

	controller := &CreateuserController{
		config: config.Config{
			ENABLE_USER_REGISTRATION: false,
		},
	}

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/v1/user/create",
		strings.NewReader(`{"username":"alice","password":"secret"}`),
	)
	ctx.Request.Header.Set("Content-Type", "application/json")

	controller.Create(ctx)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), `"error_code":"UserRegistrationIsNotEnabled"`)
}
