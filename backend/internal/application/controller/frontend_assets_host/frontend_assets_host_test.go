package frontend_assets_host

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/logger"

	"github.com/gin-gonic/gin"
)

func TestServeStatic_AllowsFileInsideRoot(t *testing.T) {
	controller := newTestController(t)

	if err := os.WriteFile(filepath.Join(controller.baseDir, "app.js"), []byte("console.log('ok');"), 0o644); err != nil {
		t.Fatalf("failed to write app.js: %v", err)
	}

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/app.js", nil)

	controller.ctrl.serveStatic(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "console.log('ok');") {
		t.Fatalf("expected js content, got %q", w.Body.String())
	}
}

func TestServeStatic_BlocksParentTraversal(t *testing.T) {
	controller := newTestController(t)

	if err := os.WriteFile(filepath.Join(controller.baseDir, "index.html"), []byte("INDEX"), 0o644); err != nil {
		t.Fatalf("failed to write index.html: %v", err)
	}

	outsideFile := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outsideFile, []byte("TOP_SECRET"), 0o644); err != nil {
		t.Fatalf("failed to write secret file: %v", err)
	}

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/../secret.txt", nil)

	controller.ctrl.serveStatic(ctx)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 fallback, got %d", w.Code)
	}
	body := w.Body.String()
	if strings.Contains(body, "TOP_SECRET") {
		t.Fatalf("path traversal leaked outside file content: %q", body)
	}
	if !strings.Contains(body, "INDEX") {
		t.Fatalf("expected SPA fallback content, got %q", body)
	}
}

func TestServeStatic_RejectsNonGET(t *testing.T) {
	controller := newTestController(t)

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/app.js", nil)

	controller.ctrl.serveStatic(ctx)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for non-GET, got %d", w.Code)
	}
}

type testController struct {
	baseDir string
	ctrl    *FrontendAssetsHostController
}

func newTestController(t *testing.T) testController {
	t.Helper()
	gin.SetMode(gin.TestMode)
	logger.InitLogger(config.Config{
		LogLevel:  "error",
		LogFormat: "text",
	})

	baseDir := t.TempDir()

	return testController{
		baseDir: baseDir,
		ctrl: &FrontendAssetsHostController{
			assetFS: os.DirFS(baseDir),
		},
	}
}
