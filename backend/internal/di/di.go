package di

import (
	"go.uber.org/dig"
)

var Container *dig.Container

func init() {
	Container = dig.New()
}
