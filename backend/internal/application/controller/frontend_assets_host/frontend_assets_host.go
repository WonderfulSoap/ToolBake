package frontend_assets_host

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"sync"
	"ya-tool-craft/internal/application/controller/common"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"
	"ya-tool-craft/internal/core/router"
	"ya-tool-craft/internal/domain/entity"
	"ya-tool-craft/internal/domain/repository"

	appembed "ya-tool-craft/internal/embed"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

func NewFrontendAssetsHostController(config config.Config, migration repository.IMigration) router.Controller {
	assetFS, err := resolveAssetFS(config.FrontendAssetPath)
	if err != nil {
		panic("failed to resolve frontend assets: " + err.Error())
	}
	return &FrontendAssetsHostController{
		Config:              config,
		assetFS:             assetFS,
		runtimeConfigScript: buildRuntimeConfigScript(config),
	}
}

// resolveAssetFS returns an fs.FS for serving frontend assets.
// If the configured path exists on disk, it uses the filesystem (os.DirFS);
// otherwise it falls back to the embedded frontend assets.
func resolveAssetFS(path string) (fs.FS, error) {
	env := config.GetEnvName()
	if env == "local" || env == "test" {
		logger.Infof(context.TODO(), "using local frontend assets from path: %s", path)
		return os.DirFS(path), nil
	}

	// Other environments use embedded assets
	sub, err := fs.Sub(appembed.Frontend, "frontend")
	logger.Infof(context.TODO(), "using embedded frontend assets")
	if err != nil {
		return nil, errors.Wrap(err, "failed to access embedded frontend assets")
	}
	return sub, nil
}

type FrontendAssetsHostController struct {
	common.JsonResponse

	Config              config.Config
	assetFS             fs.FS
	runtimeConfigScript string
	htmlCache           sync.Map // cacheKey -> []byte
}

// RouterInfo returns empty slice as this controller uses NoRoute
func (c *FrontendAssetsHostController) RouterInfo() []router.RouterInfo {
	return []router.RouterInfo{}
}

// NoRouteHandler implements NoRouteController interface
// It handles all unmatched routes and serves static files or SPA fallback
func (c *FrontendAssetsHostController) NoRouteHandler() gin.HandlerFunc {
	return c.serveStatic
}

// serveStatic handles all unmatched GET requests and serves static files or SPA fallback
func (c *FrontendAssetsHostController) serveStatic(ctx *gin.Context) {
	// Only handle GET requests, return 404 for others
	if ctx.Request.Method != http.MethodGet {
		ctx.AbortWithStatus(http.StatusNotFound)
		return
	}

	requestPath := ctx.Request.URL.Path
	logger.Infof(ctx, "frontend assets request: path=%s", requestPath)

	// Remove leading slash if present
	requestPath = strings.TrimPrefix(requestPath, "/")

	// Handle root path
	if requestPath == "" {
		requestPath = "index.html"
	}

	fsys := c.assetFS

	// Check if file exists
	info, err := fs.Stat(fsys, requestPath)
	if err == nil {
		if info.IsDir() {
			// If it's a directory, try to serve index.html inside it
			dirIndexPath := requestPath + "/index.html"
			if _, err := fs.Stat(fsys, dirIndexPath); err == nil {
				logger.Infof(ctx, "frontend assets serving directory index: %s", dirIndexPath)
				c.serveFromFS(ctx, fsys, dirIndexPath)
				return
			}
		} else {
			// Serve the file directly
			logger.Infof(ctx, "frontend assets serving file: %s", requestPath)
			c.serveFromFS(ctx, fsys, requestPath)
			return
		}
	}

	// File not found, fall back to SPA
	logger.Infof(ctx, "frontend assets fallback to SPA: %s", requestPath)
	c.serveSPAFallback(ctx, fsys)
}

// serveFromFS serves a file from the fs.FS, with HTML runtime config injection for .html files
func (c *FrontendAssetsHostController) serveFromFS(ctx *gin.Context, fsys fs.FS, relativePath string) {
	if strings.HasSuffix(relativePath, ".html") {
		c.serveHTMLWithRuntimeConfig(ctx, fsys, relativePath)
		return
	}

	f, err := fsys.Open(relativePath)
	if err != nil {
		logger.Errorf(ctx, "failed to open file: %s, err: %v", relativePath, err)
		ctx.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer f.Close()

	// Read all content to detect gzip and serve
	data, err := io.ReadAll(f)
	if err != nil {
		logger.Errorf(ctx, "failed to read file: %s, err: %v", relativePath, err)
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// Detect gzip by magic bytes (1f 8b), set Content-Encoding so browser decompresses
	if len(data) >= 2 && data[0] == 0x1f && data[1] == 0x8b {
		ctx.Header("Content-Encoding", "gzip")
	}

	info, err := fs.Stat(fsys, relativePath)
	if err != nil {
		logger.Errorf(ctx, "failed to stat file: %s, err: %v", relativePath, err)
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// Content-Type is determined by file extension (e.g. .js -> application/javascript),
	// not by content sniffing, so gzipped content won't be misdetected.
	http.ServeContent(ctx.Writer, ctx.Request, relativePath, info.ModTime(), bytes.NewReader(data))
}

// serveSPAFallback serves the SPA fallback page for client-side routing
func (c *FrontendAssetsHostController) serveSPAFallback(ctx *gin.Context, fsys fs.FS) {
	// Try __spa-fallback.html first, then fall back to index.html
	if _, err := fs.Stat(fsys, "__spa-fallback.html"); err == nil {
		logger.Infof(ctx, "frontend assets serve SPA fallback: __spa-fallback.html")
		c.serveHTMLWithRuntimeConfig(ctx, fsys, "__spa-fallback.html")
		return
	}

	logger.Infof(ctx, "frontend assets serve SPA index: index.html")
	c.serveHTMLWithRuntimeConfig(ctx, fsys, "index.html")
}

func (c *FrontendAssetsHostController) serveHTMLWithRuntimeConfig(ctx *gin.Context, fsys fs.FS, relativePath string) {
	themeClass, _ := ctx.Cookie("toolbake-ui-theme")
	themeColor, _ := ctx.Cookie("toolbake-ui-theme-color-option")
	if themeClass == "" {
		themeClass = "light"
	}
	if themeColor == "" {
		themeColor = "indigo"
	}

	// Cache key includes theme params; combinations are limited (light/dark × a few colors)
	cacheKey := relativePath + "|" + themeClass + "|" + themeColor
	if cached, ok := c.htmlCache.Load(cacheKey); ok {
		logger.Infof(ctx, "html cache hit: %s", cacheKey)
		ctx.Data(http.StatusOK, "text/html; charset=utf-8", cached.([]byte))
		return
	}

	f, err := fsys.Open(relativePath)
	if err != nil {
		logger.Errorf(ctx, "failed to open html file: %s, err: %v", relativePath, err)
		ctx.AbortWithStatus(http.StatusNotFound)
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		logger.Errorf(ctx, "failed to read html file: %s, err: %v", relativePath, err)
		ctx.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	html := string(data)

	// Inject theme
	themeTag := `<html lang="en" class="` + themeClass + ` theme-color-` + themeColor +
		`" data-theme="` + themeClass + `" data-theme-color="` + themeColor + `">`
	html = strings.Replace(html, `<html lang="en" class="light theme-color-indigo" data-theme="light" data-theme-color="indigo">`, themeTag, 1)

	// Inject runtime config (pre-computed at startup)
	anchor := `<script id="__SSR_CONFIG__" data-runtime-config-anchor="true"></script>`
	html = strings.Replace(html, anchor, c.runtimeConfigScript, 1)

	result := []byte(html)
	logger.Infof(ctx, "html cache store: %s", cacheKey)
	c.htmlCache.Store(cacheKey, result)
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", result)
}

func buildRuntimeConfigScript(cfg config.Config) string {
	var runtimeConfig entity.FrontendRuntimeConfigEntity
	runtimeConfig.SSO.Github.ClientID = cfg.SSO_GITHUB_CLIENT_ID
	runtimeConfig.SSO.Github.RedirectURI = cfg.SSO_GITHUB_REDIRECT_URL
	runtimeConfig.SSO.Google.ClientID = cfg.SSO_GOOGLE_CLIENT_ID
	runtimeConfig.SSO.Google.RedirectURI = cfg.SSO_GOOGLE_REDIRECT_URL
	runtimeConfig.EnablePasswordLogin = cfg.ENABLE_PASSWORD_LOGIN
	runtimeConfig.EnableRegister = cfg.ENABLE_USER_REGISTRATION

	var dto ssrConfigDTO
	dto.FromEntity(runtimeConfig)

	payload, err := json.Marshal(dto)
	if err != nil {
		return `<script id="__SSR_CONFIG__"></script>`
	}

	return `<script id="__SSR_CONFIG__">window.__SSR_CONFIG__ = ` + string(payload) + `;</script>`
}
