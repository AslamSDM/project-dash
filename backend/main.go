package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"pulseboard/internal/api"
	"pulseboard/internal/store"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	var (
		port        = env("PORT", "8080")
		dsn         = env("DATABASE_URL", "")
		jwtSecret   = env("JWT_SECRET", "dev-secret-change-me")
		allowOrigin = env("CORS_ORIGIN", "http://localhost:5173")
	)

	logger := newLogger()
	slog.SetDefault(logger)

	if dsn == "" {
		logger.Error("DATABASE_URL is required (Postgres connection string)")
		os.Exit(1)
	}

	db, err := store.Open(dsn)
	if err != nil {
		logger.Error("open db", slog.Any("error", err))
		os.Exit(1)
	}
	defer db.Close()

	srv := api.New(db, jwtSecret, allowOrigin, logger)
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("PulseBoard API listening", slog.String("addr", ":"+port), slog.String("api_version", api.APIVersion))
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	// Graceful shutdown.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	logger.Info("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
}

// newLogger builds a structured logger. It emits JSON by default (machine
// readable for log aggregation); set LOG_FORMAT=text for human-friendly local
// output and LOG_LEVEL=debug|info|warn|error to control verbosity.
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
	opts := &slog.HandlerOptions{Level: level}
	if strings.ToLower(env("LOG_FORMAT", "json")) == "text" {
		return slog.New(slog.NewTextHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, opts))
}
