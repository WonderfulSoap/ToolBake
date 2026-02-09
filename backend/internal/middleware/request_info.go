package middleware

import (
	"fmt"
	"strings"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// RequestInfoMiddlewareFactory output request info to logger, and add request start time to context
func RequestInfoMiddlewareFactory(config config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		fmt.Println("RequestInfoMiddlewareFactory")
		// url info ,include query params
		urlInfo := fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.String())
		// convert header to key: value, key: value, key: value
		headers := lo.Map(
			lo.Entries(c.Request.Header),
			func(item lo.Entry[string, []string], _ int) string {
				return fmt.Sprintf("%s: %s", item.Key, strings.Join(item.Value, "; "))
			},
		)
		logger.Infof(c, "request start, %s, %s", urlInfo, strings.Join(headers, ", "))

		c.Next()

		logger.Infof(c, "request over, status: %d, size: %d", c.Writer.Status(), c.Writer.Size())
	}
}
