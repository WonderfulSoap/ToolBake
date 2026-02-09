#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.0.0"
    exit 1
fi

TOTAL_START=$SECONDS

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

echo "=========================================="
echo "  ${BINARY_NAME} ${VERSION}"
echo "  commit:  ${COMMIT}"
echo "  time:    ${BUILD_TIME}"
echo "  go:      $(go version 2>/dev/null || echo 'unknown')"
echo "  targets: ${#PLATFORMS[@]} platforms"
echo "=========================================="

# --- Step 1: Copy frontend assets ---
STEP_START=$SECONDS
echo ""
echo "[1/3] Copying frontend assets..."
rm -rf "$EMBED_DIR"
mkdir -p "$EMBED_DIR"
if [ -d "$FRONTEND_SRC" ]; then
    cp -r "$FRONTEND_SRC"/. "$EMBED_DIR"/
    FILE_COUNT=$(find "$EMBED_DIR" -type f | wc -l)
    DIR_SIZE=$(du -sh "$EMBED_DIR" | cut -f1)
    echo "      src:   ${FRONTEND_SRC}"
    echo "      files: ${FILE_COUNT}, size: ${DIR_SIZE}"
else
    echo "      WARNING: ${FRONTEND_SRC} not found, embedding empty frontend"
    touch "$EMBED_DIR/.gitkeep"
fi
echo "      done in $((SECONDS - STEP_START))s"

# --- Step 2: Download modules ---
STEP_START=$SECONDS
echo ""
echo "[2/3] Downloading Go modules..."
cd "$PROJECT_ROOT"
go mod download
echo "      done in $((SECONDS - STEP_START))s"

# --- Step 3: Build binaries ---
echo ""
echo "[3/3] Cross-compiling..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

SUCCESS=0
FAIL=0

for platform in "${PLATFORMS[@]}"; do
    GOOS="${platform%/*}"
    GOARCH="${platform#*/}"

    output_name="${BINARY_NAME}-${GOOS}-${GOARCH}-${VERSION}"
    if [ "$GOOS" = "windows" ]; then
        output_name="${output_name}.exe"
    fi

    STEP_START=$SECONDS
    printf "      %-18s " "${GOOS}/${GOARCH}"
    if CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
        go build -ldflags "$LDFLAGS" -o "${BUILD_DIR}/${output_name}" "$PROJECT_ROOT"; then
        SIZE=$(du -h "${BUILD_DIR}/${output_name}" | cut -f1)
        echo "OK  ${SIZE}  $((SECONDS - STEP_START))s"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "FAILED  $((SECONDS - STEP_START))s"
        FAIL=$((FAIL + 1))
    fi
done

# Restore embed directory to placeholder state (avoid bloating git)
rm -rf "$EMBED_DIR"
mkdir -p "$EMBED_DIR"
touch "$EMBED_DIR/.gitkeep"

echo ""
echo "=========================================="
echo "  ${SUCCESS} succeeded, ${FAIL} failed"
echo "  total: $((SECONDS - TOTAL_START))s"
echo "=========================================="
