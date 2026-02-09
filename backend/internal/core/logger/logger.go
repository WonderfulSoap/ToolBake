package logger

import (
	"context"
	"fmt"
	"strings"
	"time"
	"ya-tool-craft/internal/config"
	"ya-tool-craft/internal/core/requestid"

	"github.com/sirupsen/logrus"
)

var log *logrus.Logger

func InitLogger(config config.Config) {
	log = logrus.New()

	// Set log level
	switch strings.ToLower(config.LogLevel) {
	case "debug":
		log.SetLevel(logrus.DebugLevel)
	case "info":
		log.SetLevel(logrus.InfoLevel)
	case "warn":
		log.SetLevel(logrus.WarnLevel)
	case "error":
		log.SetLevel(logrus.ErrorLevel)
	default:
		log.SetLevel(logrus.InfoLevel) // Default to InfoLevel
	}

	// set log format by config
	if config.LogFormat == "json" {
		log.SetFormatter(&logrus.JSONFormatter{})
	} else {
		log.SetFormatter(&logrus.TextFormatter{
			ForceColors:   true,
			FullTimestamp: true,
		})
	}
}

// get request id from context
func withExtraInfo(ctx context.Context) *logrus.Entry {
	// get request id from context
	requestID := requestid.GetRequestID(ctx)

	// get request start time from context
	nowT := time.Now()
	startTime := requestid.GetRequestStartTime(ctx)
	diff := float64(nowT.UnixMilli()-startTime.UnixMilli()) / 1000 //calculate time diff between now and request start time
	diffStr := fmt.Sprintf("+%.2fs", diff)

	return log.
		WithField("request_id", requestID).
		WithField("time_cost", diffStr)
}

// Info  logrus.Info
func Info(ctx context.Context, args ...any) {
	withExtraInfo(ctx).Info(args...)
}

// Infof  logrus.Infof
func Infof(ctx context.Context, format string, args ...any) {
	withExtraInfo(ctx).Infof(format, args...)
}

// Error  logrus.Error
func Error(ctx context.Context, args ...any) {
	withExtraInfo(ctx).Error(args...)
}

// Errorf  logrus.Errorf
func Errorf(ctx context.Context, format string, args ...any) {
	withExtraInfo(ctx).Errorf(format, args...)
}

// Warn  logrus.Warn
func Warn(ctx context.Context, args ...any) {
	withExtraInfo(ctx).Warn(args...)
}

// Warnf  logrus.Warnf
func Warnf(ctx context.Context, format string, args ...any) {
	withExtraInfo(ctx).Warnf(format, args...)
}

// Debug  logrus.Debug
func Debug(ctx context.Context, args ...any) {
	withExtraInfo(ctx).Debug(args...)
}

// Debugf  logrus.Debugf
func Debugf(ctx context.Context, format string, args ...any) {
	withExtraInfo(ctx).Debugf(format, args...)
}
