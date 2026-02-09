#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <version> <image-name> [--push|--load]"
    echo ""
    echo "  --push   Build linux/amd64,linux/arm64 and push to registry"
    echo "  --load   Build current platform only and load into local docker"
    echo "  (none)   Build linux/amd64,linux/arm64 (cache only, no output)"
    echo ""
    echo "Example: $0 v1.0.0 myrepo/toolbake --load"
    echo "Example: $0 v1.0.0 myrepo/toolbake --push"
    exit 1
fi

VERSION="$1"
IMAGE_NAME="$2"
MODE="${3:-}"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILDER_NAME="multiplatform"

# Ensure a buildx builder with docker-container driver exists
if ! docker buildx inspect "${BUILDER_NAME}" &>/dev/null; then
    echo "Creating buildx builder '${BUILDER_NAME}'..."
    docker buildx create --name "${BUILDER_NAME}" --driver docker-container
fi
docker buildx use "${BUILDER_NAME}"

BUILD_ARGS=(
    --build-arg "VERSION=${VERSION}"
    -t "${IMAGE_NAME}:${VERSION}"
    -t "${IMAGE_NAME}:latest"
)

case "${MODE}" in
    --push)
        BUILD_ARGS+=(--platform linux/amd64,linux/arm64 --push)
        ;;
    --load)
        BUILD_ARGS+=(--load)
        ;;
    *)
        BUILD_ARGS+=(--platform linux/amd64,linux/arm64)
        ;;
esac

docker buildx build "${BUILD_ARGS[@]}" "${PROJECT_ROOT}"
