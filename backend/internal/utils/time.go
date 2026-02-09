package utils

import (
	"math"
	"time"
)

func Uint64ToTimeDuration(d uint64) (duration time.Duration) {
	// if d overflow, just set new duration as max of time.Duration
	if d > math.MaxUint64-1 {
		duration = time.Duration(math.MaxInt64)
	}
	duration = time.Duration(d)
	return
}

// TTLInSecondToTimeDuration converts ttl in seconds to time.Duration
func TTLInSecondToTimeDuration(ttl uint64) time.Duration {
	return Uint64ToTimeDuration(ttl * uint64(time.Second))
}

// NowToSecond returns the current time truncated to seconds
func NowToSecond() time.Time {
	return time.Now().Truncate(time.Second).UTC()
}
