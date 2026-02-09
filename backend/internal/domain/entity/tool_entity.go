package entity

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ToolEntity struct {
	UniqueID          string
	ID                string
	Name              string
	Namespace         string
	IsActivate        bool
	RealtimeExecution bool
	UiWidgets         string
	Source            string
	Description       string
	ExtraInfo         map[string]string
	Category          string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func NewToolEntityWithoutUID(
	id, name, namespace, category string,
	isActivate, realtimeExecution bool,
	uiWidgets, source string,
	description string,
	extraInfo map[string]string,
	createdAt, updatedAt time.Time,
) ToolEntity {
	uniqueID := fmt.Sprintf("tool-%s", uuid.New().String())
	return ToolEntity{
		UniqueID:          uniqueID,
		ID:                id,
		Name:              name,
		Namespace:         namespace,
		IsActivate:        isActivate,
		RealtimeExecution: realtimeExecution,
		UiWidgets:         uiWidgets,
		Source:            source,
		Description:       description,
		ExtraInfo:         copyExtraInfo(extraInfo),
		Category:          category,
		CreatedAt:         createdAt,
		UpdatedAt:         updatedAt,
	}
}

func NewToolEntityWithUID(
	uniqueID, id, name, namespace string,
	category string,
	isActivate, realtimeExecution bool,
	uiWidgets, source string,
	description string,
	extraInfo map[string]string,
	createdAt, updatedAt time.Time,
) ToolEntity {
	return ToolEntity{
		UniqueID:          uniqueID,
		ID:                id,
		Name:              name,
		Namespace:         namespace,
		IsActivate:        isActivate,
		RealtimeExecution: realtimeExecution,
		UiWidgets:         uiWidgets,
		Source:            source,
		Description:       description,
		ExtraInfo:         copyExtraInfo(extraInfo),
		Category:          category,
		CreatedAt:         createdAt,
		UpdatedAt:         updatedAt,
	}
}

type ToolsEntity struct {
	Tools         []ToolEntity
	LastUpdatedAt time.Time
}

func copyExtraInfo(info map[string]string) map[string]string {
	if info == nil {
		return map[string]string{}
	}

	result := make(map[string]string, len(info))
	for key, value := range info {
		result[key] = value
	}
	return result
}
