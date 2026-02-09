package utils

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

func StringRemoveAllSpace(s string) string {
	return strings.ReplaceAll(s, " ", "")
}

func Sha256String(s string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(s)))
}
