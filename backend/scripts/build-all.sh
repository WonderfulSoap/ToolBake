#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.0.0"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BINARY_NAME="toolbake"
BUILD_DIR="${PROJECT_ROOT}/bin"
VERSION="$1"
BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
COMMIT="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")"

LDFLAGS="-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME} -X main.Commit=${COMMIT}"

FRONTEND_SRC="${PROJECT_ROOT}/../app/build/client"
EMBED_DIR="${PROJECT_ROOT}/internal/embed/frontend"

PLATFORMS=(
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
)

# Copy frontend build output into embed directory for go:embed
echo "Copying frontend assets into embed directory..."
rm -rf "$EMBED_DIR"
mkdir -p "$EMBED_DIR"
if [ -d "$FRONTEND_SRC" ]; then
    cp -r "$FRONTEND_SRC"/. "$EMBED_DIR"/
    echo "   Frontend assets copied from ${FRONTEND_SRC}"
else
    echo "   WARNING: Frontend source ${FRONTEND_SRC} not found, embedding empty frontend"
    touch "$EMBED_DIR/.gitkeep"
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "Building ${BINARY_NAME} ${VERSION} (${COMMIT})"
echo "=========================================="

SUCCESS=0
FAIL=0

for platform in "${PLATFORMS[@]}"; do
    GOOS="${platform%/*}"
    GOARCH="${platform#*/}"

    output_name="${BINARY_NAME}-${GOOS}-${GOARCH}-${VERSION}"
    if [ "$GOOS" = "windows" ]; then
        output_name="${output_name}.exe"
    fi

    echo "-> ${GOOS}/${GOARCH}"
    if CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
        go build -ldflags "$LDFLAGS" -o "${BUILD_DIR}/${output_name}" "$PROJECT_ROOT"; then
        SUCCESS=$((SUCCESS + 1))
    else
        echo "   [FAILED]"
        FAIL=$((FAIL + 1))
    fi
done

# Restore embed directory to placeholder state (avoid bloating git)
rm -rf "$EMBED_DIR"
mkdir -p "$EMBED_DIR"
touch "$EMBED_DIR/.gitkeep"

echo "=========================================="
echo "Done: ${SUCCESS} succeeded, ${FAIL} failed"
if [ "$SUCCESS" -gt 0 ]; then
    echo ""
    ls -lh "$BUILD_DIR"/
fi
