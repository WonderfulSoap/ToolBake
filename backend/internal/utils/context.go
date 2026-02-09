package utils

import (
	"context"
	"sync"
)

type ContextWithValue interface {
	context.Context

	Set(key string, value any)
	Get(key string) (value any, exists bool)
}

type valueContext struct {
	context.Context
	values sync.Map
}

func NewValueContext(ctx context.Context) ContextWithValue {
	if ctx == nil {
		ctx = context.Background()
	}
	return &valueContext{
		Context: ctx,
	}
}

func (c *valueContext) Set(key string, value any) {
	c.values.Store(key, value)
}

func (c *valueContext) Get(key string) (value any, exists bool) {
	return c.values.Load(key)
}

func (c *valueContext) Value(key any) any {
	if keyStr, ok := key.(string); ok {
		if val, exists := c.values.Load(keyStr); exists {
			return val
		}
	}
	return c.Context.Value(key)
}
