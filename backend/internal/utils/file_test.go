package utils

import (
	"os"
	"testing"
)

func TestFileExists(t *testing.T) {
	// create temp test file
	tmpFile, err := os.CreateTemp("", "test_file_*")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name()) // clean up after test
	tmpFile.Close()

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     "existing file",
			path:     tmpFile.Name(),
			expected: true,
		},
		{
			name:     "non-existent file",
			path:     "not_exists_file.txt",
			expected: false,
		},
		{
			name:     "empty path",
			path:     "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FileExists(tt.path)
			if result != tt.expected {
				t.Errorf("FileExists() = %v, expected %v", result, tt.expected)
			}
		})
	}
}

func TestIsDir(t *testing.T) {
	// create temp directory
	tmpDir, err := os.MkdirTemp("", "test_dir_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// create temp file
	tmpFile, err := os.CreateTemp("", "test_file_*")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     "existing directory",
			path:     tmpDir,
			expected: true,
		},
		{
			name:     "existing file (not a directory)",
			path:     tmpFile.Name(),
			expected: false,
		},
		{
			name:     "non-existent path",
			path:     "/tmp/non_existent_path_xyz",
			expected: false,
		},
		{
			name:     "empty path",
			path:     "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsDir(tt.path)
			if result != tt.expected {
				t.Errorf("IsDir() = %v, expected %v", result, tt.expected)
			}
		})
	}
}
