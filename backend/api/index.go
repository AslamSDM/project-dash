// Package handler is the Vercel serverless entrypoint for the PulseBoard API.
//
// Vercel routes every /api/* request to this single function (see vercel.json),
// and we hand it off to the same chi-free net/http router used by the
// standalone server in main.go. The store and router are built once per warm
// function instance and reused across invocations.
package handler

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"

	"pulseboard/internal/api"
	"pulseboard/internal/store"
)

var (
	once    sync.Once
	routes  http.Handler
	initErr error
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func newLogger() *slog.Logger {
	level := slog.LevelInfo
	switch strings.ToLower(env("LOG_LEVEL", "info")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	// JSON to stdout — Vercel captures function logs and ships them to the
	// dashboard / drains.
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
}

func build() {
	logger := newLogger()
	slog.SetDefault(logger)

	dsn := env("DATABASE_URL", "")
	if dsn == "" {
		initErr = errMissingDSN
		logger.Error("DATABASE_URL is not set")
		return
	}
	db, err := store.Open(dsn)
	if err != nil {
		initErr = err
		logger.Error("open db", slog.Any("error", err))
		return
	}
	srv := api.New(db, env("JWT_SECRET", "dev-secret-change-me"), env("CORS_ORIGIN", "*"), logger)
	routes = srv.Routes()
}

// Handler is the exported entrypoint Vercel invokes for each request.
func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(build)
	if initErr != nil {
		http.Error(w, `{"error":"service unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	routes.ServeHTTP(w, r)
}

type sentinelErr string

func (e sentinelErr) Error() string { return string(e) }

const errMissingDSN = sentinelErr("DATABASE_URL is required")
