package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RequestIDMiddlewareFactory() gin.HandlerFunc {
	return func(c *gin.Context) {
		// fmt.Println("RequestIDMiddlewareFactory")
		// requestID := c.GetHeader("X-Request-ID")
		// if requestID == "" {
		// c.Header("X-Request-ID", requestID)
		// }
		requestID := uuid.New().String()
		c.Set("x-request-id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}
