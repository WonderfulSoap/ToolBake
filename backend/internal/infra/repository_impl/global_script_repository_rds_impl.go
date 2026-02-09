package repository_impl

import (
	"database/sql"
	stdErrors "errors"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	pkgerrors "github.com/pkg/errors"
)

func NewGlobalScriptRepositoryRdsImpl(config config.Config, client repository.IRdsClient) *GlobalScriptRepositoryRdsImpl {
	return &GlobalScriptRepositoryRdsImpl{config: config, client: client}
}

type GlobalScriptRepositoryRdsImpl struct {
	config config.Config
	client repository.IRdsClient
}

type GlobalScriptRdsModel struct {
	UserID    string    `db:"user_id"`
	Script    string    `db:"script"`
	UpdatedAt time.Time `db:"updated_at"`
}

func (r *GlobalScriptRepositoryRdsImpl) GetGlobalScript(userID entity.UserIDEntity) (*entity.GlobalScriptEntity, error) {
	db := r.client.DB()
	var model GlobalScriptRdsModel

	err := db.Get(&model, "SELECT user_id, script, updated_at FROM global_scripts WHERE user_id = ?", string(userID))
	if err != nil {
		if stdErrors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, pkgerrors.Wrap(err, "fail to get global script")
	}

	entity := entity.NewGlobalScriptEntity(model.Script, model.UpdatedAt)
	return &entity, nil
}

func (r *GlobalScriptRepositoryRdsImpl) UpdateGlobalScript(userID entity.UserIDEntity, script string) error {
	db := r.client.DB()
	now := time.Now()

	var query string
	switch r.config.DBType {
	case "mysql":
		query = `INSERT INTO global_scripts (user_id, script, updated_at)
		 VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE script = ?, updated_at = ?`
	default:
		query = `INSERT INTO global_scripts (user_id, script, updated_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET script = ?, updated_at = ?`
	}

	_, err := db.Exec(query, string(userID), script, now, script, now)
	if err != nil {
		return pkgerrors.Wrap(err, "fail to upsert global script")
	}

	return nil
}
