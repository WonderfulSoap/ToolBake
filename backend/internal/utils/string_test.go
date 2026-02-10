package utils

import (
	"testing"
)

func TestStringRemoveAllSpace(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no spaces",
			input:    "hello",
			expected: "hello",
		},
		{
			name:     "spaces in between",
			input:    "hello world",
			expected: "helloworld",
		},
		{
			name:     "leading and trailing spaces",
			input:    " hello ",
			expected: "hello",
		},
		{
			name:     "multiple spaces",
			input:    "a  b  c",
			expected: "abc",
		},
		{
			name:     "only spaces",
			input:    "   ",
			expected: "",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := StringRemoveAllSpace(tt.input)
			if result != tt.expected {
				t.Errorf("StringRemoveAllSpace(%q) = %q, expected %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestSha256String(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			name:     "hello",
			input:    "hello",
			expected: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		},
		{
			name:     "deterministic",
			input:    "test",
			expected: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Sha256String(tt.input)
			if result != tt.expected {
				t.Errorf("Sha256String(%q) = %q, expected %q", tt.input, result, tt.expected)
			}
		})
	}
}
