package unittest

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/infra/repository_impl/client"
	"ya-tool-craft/internal/infra/repository_impl/migration"

	"github.com/pkg/errors"
)

var (
	ctx          context.Context
	cnf          config.Config
	writableConf config.WritableConfig
)

func init() {
	wd, _ := os.Getwd() // get current wd and save it
	projectFolder := UnitTestGetProjectPath()
	os.Chdir(projectFolder) // change to project folder

	// set env to local, so config will load from .env.local
	os.Setenv("APP_ENV", "test")
	ctx = context.TODO()

	c, err := config.NewConfig()
	if err != nil {
		panic(errors.Errorf("failed to get config from di container: %v", err))
	}

	cnf = c
	writableConf = config.NewWritableConfig(c)

	// init logger
	logger.InitLogger(c)

	os.Chdir(wd) // restore wd
}

type UnitTestContext struct {
	Config         config.Config
	WritableConfig config.WritableConfig
	Context        context.Context
}

func (c *UnitTestContext) WithClearSqlite(callback func(ctx context.Context, client *client.SqliteClient)) {
	client, err := client.NewSqliteClient(c.Config)
	if err != nil {
		panic(errors.Errorf("init unit test failed, create sqlite client fail: %+v", err))
	}

	// run migrate for sqlite
	migration := migration.NewRdsMigrationImpl(client, c.Config)
	err = migration.RunMigrate(c.Context)
	if err != nil {
		panic(errors.Errorf("init unit test failed, migrate sqlite db fail: %+v", err))
	}
	fmt.Println("run sqlite migration ok")

	// Give the database a moment to fully initialize and release any locks
	// This ensures concurrent tests don't fail due to table initialization timing issues
	time.Sleep(100 * time.Millisecond)

	callback(c.Context, client)
	defer client.Close()
}

func (c *UnitTestContext) WithClearMysql(callback func(ctx context.Context, client *client.MysqlClient)) {
	client, err := client.NewMysqlClient(c.Config)
	if err != nil {
		panic(errors.Errorf("init unit test failed, create mysql client fail: %+v", err))
	}

	// run migrate for mysql
	migration := migration.NewRdsMigrationImpl(client, c.Config)
	err = migration.RunMigrate(c.Context)
	if err != nil {
		panic(errors.Errorf("init unit test failed, migrate mysql db fail: %+v", err))
	}
	fmt.Println("run mysql migration ok")

	callback(c.Context, client)
	defer client.Close()
}

func (c *UnitTestContext) WithClearBadger(callback func(ctx context.Context, client *client.BadgerClient)) {
	client, err := client.NewBadgerClient(c.Config)
	if err != nil {
		panic(errors.Errorf("init unit test failed, create badger client fail: %+v", err))
	}

	callback(c.Context, client)
	defer client.Close()
}

func (c *UnitTestContext) WithClearNutsDB(callback func(ctx context.Context, client *client.NutsDBClient)) {
	client, err := client.NewNutsDBClient(c.Config)
	if err != nil {
		panic(errors.Errorf("init unit test failed, create nutsdb client fail: %+v", err))
	}

	callback(c.Context, client)
	defer client.Close()
}

func UnitTestGetProjectPath() string {
	_, currentFilePath, _, ok := runtime.Caller(0)
	if !ok {
		panic(errors.New("init unit test failed, get current file path fail"))
	}
	ppFolder := filepath.Dir(filepath.Dir(filepath.Dir(currentFilePath)))
	if !filepath.IsAbs(ppFolder) {
		p, _ := filepath.Abs(ppFolder)
		return p
	}
	return ppFolder
}

func GetUnitTestCtx() UnitTestContext {
	return UnitTestContext{
		Config:         cnf,
		WritableConfig: writableConf,
		Context:        ctx,
	}
}
