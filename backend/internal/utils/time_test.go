package utils

import (
	"math"
	"testing"
	"time"
)

func TestUint64ToTimeDuration(t *testing.T) {
	tests := []struct {
		name     string
		input    uint64
		expected time.Duration
	}{
		{
			name:     "zero value",
			input:    0,
			expected: time.Duration(0),
		},
		{
			name:     "small value",
			input:    uint64(5 * time.Second),
			expected: 5 * time.Second,
		},
		{
			name:     "one nanosecond",
			input:    1,
			expected: time.Duration(1),
		},
		{
			name:     "max int64 value",
			input:    uint64(math.MaxInt64),
			expected: time.Duration(math.MaxInt64),
		},
		{
			// NOTE: the overflow guard in Uint64ToTimeDuration is ineffective
			// because duration is unconditionally overwritten after the if block.
			name:     "max uint64 value (overflow not guarded)",
			input:    math.MaxUint64,
			expected: -1, // time.Duration(math.MaxUint64) wraps to -1
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Uint64ToTimeDuration(tt.input)
			if result != tt.expected {
				t.Errorf("Uint64ToTimeDuration(%d) = %v, expected %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestTTLInSecondToTimeDuration(t *testing.T) {
	tests := []struct {
		name     string
		ttl      uint64
		expected time.Duration
	}{
		{
			name:     "zero seconds",
			ttl:      0,
			expected: 0,
		},
		{
			name:     "one second",
			ttl:      1,
			expected: time.Second,
		},
		{
			name:     "60 seconds",
			ttl:      60,
			expected: 60 * time.Second,
		},
		{
			name:     "3600 seconds (1 hour)",
			ttl:      3600,
			expected: time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := TTLInSecondToTimeDuration(tt.ttl)
			if result != tt.expected {
				t.Errorf("TTLInSecondToTimeDuration(%d) = %v, expected %v", tt.ttl, result, tt.expected)
			}
		})
	}
}

func TestNowToSecond(t *testing.T) {
	before := time.Now().Truncate(time.Second).UTC()
	result := NowToSecond()
	after := time.Now().Truncate(time.Second).UTC()

	if result.Before(before) || result.After(after) {
		t.Errorf("NowToSecond() = %v, expected between %v and %v", result, before, after)
	}

	if result.Nanosecond() != 0 {
		t.Errorf("NowToSecond() has sub-second precision: %v", result)
	}

	if result.Location() != time.UTC {
		t.Errorf("NowToSecond() location = %v, expected UTC", result.Location())
	}
}
