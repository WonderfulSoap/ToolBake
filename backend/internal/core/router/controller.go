package router

import (
	"github.com/gin-gonic/gin"
)

type RouterInfo struct {
	Method      string
	Path        string
	Handler     gin.HandlerFunc
	Middlewares []gin.HandlerFunc
}

type Controller interface {
	RouterInfo() []RouterInfo
}

// NoRouteController is an optional interface for controllers that handle unmatched routes
type NoRouteController interface {
	Controller
	NoRouteHandler() gin.HandlerFunc
}
