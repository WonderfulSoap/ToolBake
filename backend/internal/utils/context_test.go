package utils

import (
	"context"
	"testing"
)

func TestNewValueContext(t *testing.T) {
	t.Run("with non-nil context", func(t *testing.T) {
		parent := context.Background()
		ctx := NewValueContext(parent)
		if ctx == nil {
			t.Fatal("NewValueContext() returned nil")
		}
	})

	t.Run("with nil context", func(t *testing.T) {
		ctx := NewValueContext(nil)
		if ctx == nil {
			t.Fatal("NewValueContext(nil) returned nil")
		}
	})
}

func TestValueContext_SetAndGet(t *testing.T) {
	ctx := NewValueContext(context.Background())

	t.Run("get non-existent key", func(t *testing.T) {
		val, exists := ctx.Get("missing")
		if exists {
			t.Errorf("Get(missing) exists = true, expected false")
		}
		if val != nil {
			t.Errorf("Get(missing) value = %v, expected nil", val)
		}
	})

	t.Run("set and get string value", func(t *testing.T) {
		ctx.Set("name", "alice")
		val, exists := ctx.Get("name")
		if !exists {
			t.Fatal("Get(name) exists = false, expected true")
		}
		if val != "alice" {
			t.Errorf("Get(name) = %v, expected alice", val)
		}
	})

	t.Run("set and get int value", func(t *testing.T) {
		ctx.Set("count", 42)
		val, exists := ctx.Get("count")
		if !exists {
			t.Fatal("Get(count) exists = false, expected true")
		}
		if val != 42 {
			t.Errorf("Get(count) = %v, expected 42", val)
		}
	})

	t.Run("overwrite existing key", func(t *testing.T) {
		ctx.Set("name", "bob")
		val, exists := ctx.Get("name")
		if !exists {
			t.Fatal("Get(name) exists = false, expected true")
		}
		if val != "bob" {
			t.Errorf("Get(name) = %v, expected bob", val)
		}
	})
}

func TestValueContext_Value(t *testing.T) {
	type parentKey struct{}
	parent := context.WithValue(context.Background(), parentKey{}, "from_parent")
	ctx := NewValueContext(parent)
	ctx.Set("local", "from_local")

	t.Run("string key found in local values", func(t *testing.T) {
		val := ctx.Value("local")
		if val != "from_local" {
			t.Errorf("Value(local) = %v, expected from_local", val)
		}
	})

	t.Run("non-string key falls back to parent", func(t *testing.T) {
		val := ctx.Value(parentKey{})
		if val != "from_parent" {
			t.Errorf("Value(parentKey) = %v, expected from_parent", val)
		}
	})

	t.Run("string key not found falls back to parent", func(t *testing.T) {
		val := ctx.Value("not_set")
		if val != nil {
			t.Errorf("Value(not_set) = %v, expected nil", val)
		}
	})

	t.Run("local value shadows parent with same string key", func(t *testing.T) {
		parent := context.WithValue(context.Background(), "shared", "parent_val")
		ctx := NewValueContext(parent)
		ctx.Set("shared", "local_val")

		val := ctx.Value("shared")
		if val != "local_val" {
			t.Errorf("Value(shared) = %v, expected local_val", val)
		}
	})
}
