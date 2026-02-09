package repository_impl

import (
	"database/sql"
	"encoding/json"
	stdErrors "errors"
	"time"

	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	pkgerrors "github.com/pkg/errors"
)

func NewToolRepositoryRdsImpl(config config.Config, client repository.IRdsClient) *ToolRepositoryRdsImpl {
	return &ToolRepositoryRdsImpl{config: config, client: client}
}

type ToolRepositoryRdsImpl struct {
	config config.Config
	client repository.IRdsClient
}

type ToolRdsModel struct {
	UserID            string    `db:"user_id"`
	ID                string    `db:"id"`
	UniqueID          string    `db:"unique_id"`
	Name              string    `db:"name"`
	Namespace         string    `db:"namespace"`
	IsActivate        bool      `db:"is_activate"`
	RealtimeExecution bool      `db:"realtime_execution"`
	UiWidgets         string    `db:"ui_widgets"`
	Source            string    `db:"source"`
	Description       string    `db:"description"`
	ExtraInfo         string    `db:"extra_info"`
	Category          string    `db:"category"`
	CreatedAt         time.Time `db:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"`
}

type execer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

func (r *ToolRepositoryRdsImpl) CreateTool(userID entity.UserIDEntity, tool entity.ToolEntity) error {
	now := time.Now()
	tool.CreatedAt = now
	tool.UpdatedAt = now
	db := r.client.DB()
	tx, err := db.Beginx()
	if err != nil {
		return pkgerrors.Wrap(err, "fail to begin tool creation transaction")
	}

	extraInfoJSON, err := encodeExtraInfo(tool.ExtraInfo)
	if err != nil {
		tx.Rollback()
		return pkgerrors.Wrap(err, "fail to encode extra info")
	}

	_, err = tx.Exec(
		`INSERT INTO tools (
			user_id,
			id,
			unique_id,
			name,
			namespace,
			category,
			is_activate,
			realtime_execution,
			ui_widgets,
			source,
			description,
			extra_info,
			created_at,
			updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		string(userID),
		tool.ID,
		tool.UniqueID,
		tool.Name,
		tool.Namespace,
		tool.Category,
		tool.IsActivate,
		tool.RealtimeExecution,
		tool.UiWidgets,
		tool.Source,
		tool.Description,
		extraInfoJSON,
		now,
		now,
	)
	if err != nil {
		tx.Rollback()
		return pkgerrors.Wrap(err, "fail to insert tool into rds")
	}

	if err = r.upsertToolsLastUpdatedAt(tx, userID, time.Now()); err != nil {
		tx.Rollback()
		return err
	}

	if err = tx.Commit(); err != nil {
		return pkgerrors.Wrap(err, "fail to commit tool creation transaction")
	}

	return nil
}

func (r *ToolRepositoryRdsImpl) UpdateTool(userID entity.UserIDEntity, tool entity.ToolEntity) error {
	now := time.Now()
	tool.UpdatedAt = now

	db := r.client.DB()
	tx, err := db.Beginx()
	if err != nil {
		return pkgerrors.Wrap(err, "fail to begin tool update transaction")
	}

	extraInfoJSON, err := encodeExtraInfo(tool.ExtraInfo)
	if err != nil {
		tx.Rollback()
		return pkgerrors.Wrap(err, "fail to encode extra info")
	}

	_, err = tx.Exec(
		`UPDATE tools SET
			id = ?,
			name = ?,
			namespace = ?,
			category = ?,
			is_activate = ?,
			realtime_execution = ?,
			ui_widgets = ?,
			source = ?,
			description = ?,
			extra_info = ?,
			updated_at = ?
		WHERE user_id = ? AND unique_id = ?`,
		tool.ID,
		tool.Name,
		tool.Namespace,
		tool.Category,
		tool.IsActivate,
		tool.RealtimeExecution,
		tool.UiWidgets,
		tool.Source,
		tool.Description,
		extraInfoJSON,
		now,
		string(userID),
		tool.UniqueID,
	)
	if err != nil {
		tx.Rollback()
		return pkgerrors.Wrap(err, "fail to update tool in rds")
	}

	if err = r.upsertToolsLastUpdatedAt(tx, userID, time.Now()); err != nil {
		tx.Rollback()
		return err
	}

	if err = tx.Commit(); err != nil {
		return pkgerrors.Wrap(err, "fail to commit tool update transaction")
	}

	return nil
}

func (r *ToolRepositoryRdsImpl) DeleteTool(userID entity.UserIDEntity, toolUID string) error {
	db := r.client.DB()
	tx, err := db.Beginx()
	if err != nil {
		return pkgerrors.Wrap(err, "fail to begin tool delete transaction")
	}

	_, err = tx.Exec("DELETE FROM tools WHERE user_id = ? AND unique_id = ?", string(userID), toolUID)
	if err != nil {
		tx.Rollback()
		return pkgerrors.Wrap(err, "fail to delete tool from rds")
	}

	if err = r.upsertToolsLastUpdatedAt(tx, userID, time.Now()); err != nil {
		tx.Rollback()
		return err
	}

	if err = tx.Commit(); err != nil {
		return pkgerrors.Wrap(err, "fail to commit tool delete transaction")
	}

	return nil
}

func (r *ToolRepositoryRdsImpl) AllTools(userID entity.UserIDEntity) (entity.ToolsEntity, error) {
	db := r.client.DB()
	var models []ToolRdsModel

	if err := db.Select(&models, "SELECT * FROM tools WHERE user_id = ?", string(userID)); err != nil {
		return entity.ToolsEntity{}, pkgerrors.Wrap(err, "fail to select tools")
	}

	tools := make([]entity.ToolEntity, 0, len(models))
	for _, model := range models {
		tools = append(tools, toToolEntity(model))
	}

	lastUpdatedAt, err := r.ToolsLastUpdatedAt(userID)
	if err != nil {
		return entity.ToolsEntity{}, err
	}

	result := entity.ToolsEntity{Tools: tools}
	if lastUpdatedAt != nil {
		result.LastUpdatedAt = *lastUpdatedAt
	}

	return result, nil
}

func (r *ToolRepositoryRdsImpl) ToolsLastUpdatedAt(userID entity.UserIDEntity) (*time.Time, error) {
	db := r.client.DB()
	var lastUpdated time.Time

	err := db.Get(
		&lastUpdated,
		"SELECT last_updated_at FROM tools_last_update_at WHERE user_id = ?",
		string(userID),
	)
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, pkgerrors.Wrap(err, "fail to get tools last update time")
	}

	return &lastUpdated, nil
}

func (r *ToolRepositoryRdsImpl) upsertToolsLastUpdatedAt(exec execer, userID entity.UserIDEntity, updatedAt time.Time) error {
	var query string
	switch r.config.DBType {
	case "mysql":
		query = `INSERT INTO tools_last_update_at (user_id, last_updated_at)
		 VALUES (?, ?)
		 ON DUPLICATE KEY UPDATE last_updated_at = ?`
	default:
		query = `INSERT INTO tools_last_update_at (user_id, last_updated_at)
		 VALUES (?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET last_updated_at = ?`
	}

	_, err := exec.Exec(query, string(userID), updatedAt, updatedAt)
	if err != nil {
		return pkgerrors.Wrap(err, "fail to upsert tools last update time")
	}

	return nil
}

func toToolEntity(model ToolRdsModel) entity.ToolEntity {
	return entity.NewToolEntityWithUID(
		model.UniqueID,
		model.ID,
		model.Name,
		model.Namespace,
		model.Category,
		model.IsActivate,
		model.RealtimeExecution,
		model.UiWidgets,
		model.Source,
		model.Description,
		decodeExtraInfo(model.ExtraInfo),
		model.CreatedAt,
		model.UpdatedAt,
	)
}

func encodeExtraInfo(info map[string]string) (string, error) {
	if info == nil {
		info = map[string]string{}
	}

	encoded, err := json.Marshal(info)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func decodeExtraInfo(raw string) map[string]string {
	if raw == "" {
		return map[string]string{}
	}

	var decoded map[string]string
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return map[string]string{}
	}
	if decoded == nil {
		return map[string]string{}
	}
	return decoded
}
