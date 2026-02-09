package embed

import "embed"

// Frontend embeds the frontend build output.
// The "frontend" directory is populated by the build script before compilation.
// When building without the script (e.g. during development), this will be empty.
//
//go:embed all:frontend
var Frontend embed.FS
