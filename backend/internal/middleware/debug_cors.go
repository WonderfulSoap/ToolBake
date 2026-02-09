package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// DebugCORSMiddleware allows every origin while gin runs in debug mode.
func DebugCORSMiddleware() gin.HandlerFunc {
	if gin.Mode() != gin.DebugMode {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		requestHeaders := c.GetHeader("Access-Control-Request-Headers")
		if requestHeaders == "" {
			requestHeaders = "*"
		}
		c.Header("Access-Control-Allow-Headers", requestHeaders)
		c.Header("Access-Control-Expose-Headers", "*")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
