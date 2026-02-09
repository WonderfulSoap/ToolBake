package middleware

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestStartTimeMiddlewareFactory add request start time to gin context, so logger can use it to calculate time cost between request start and logger output
func RequestStartTimeMiddlewareFactory() gin.HandlerFunc {
	return func(c *gin.Context) {
		fmt.Println("RequestStartTimeMiddlewareFactory")
		c.Set("request-start-time", time.Now())
		c.Next()
	}
}
