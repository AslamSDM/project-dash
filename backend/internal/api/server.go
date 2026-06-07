package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"pulseboard/internal/store"
)

// APIVersion is the current API version prefix. All application routes are
// served under /api/<version>/ so clients can pin a version and we can ship
// breaking changes under a new prefix without disrupting existing clients.
const APIVersion = "v1"

// apiPrefix is the full mount path for versioned routes, e.g. "/api/v1".
const apiPrefix = "/api/" + APIVersion

// Server holds dependencies shared by all handlers.
type Server struct {
	store       *store.Store
	jwtSecret   []byte
	allowOrigin string
	log         *slog.Logger
}

// New builds a Server. If log is nil, slog.Default() is used.
func New(s *store.Store, jwtSecret, allowOrigin string, log *slog.Logger) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{store: s, jwtSecret: []byte(jwtSecret), allowOrigin: allowOrigin, log: log}
}

// Routes returns the fully wired HTTP handler.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	// Unversioned platform health check (used by uptime probes / Vercel).
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET "+apiPrefix+"/health", s.handleHealth)

	// Public
	mux.HandleFunc("POST "+apiPrefix+"/auth/register", s.handleRegister)
	mux.HandleFunc("POST "+apiPrefix+"/auth/login", s.handleLogin)

	// Protected
	mux.Handle("GET "+apiPrefix+"/auth/me", s.auth(http.HandlerFunc(s.handleMe)))
	mux.Handle("GET "+apiPrefix+"/profile", s.auth(http.HandlerFunc(s.handleGetProfile)))
	mux.Handle("PUT "+apiPrefix+"/profile", s.auth(http.HandlerFunc(s.handleUpdateProfile)))

	mux.Handle("GET "+apiPrefix+"/projects", s.auth(http.HandlerFunc(s.handleListProjects)))
	mux.Handle("POST "+apiPrefix+"/projects", s.auth(http.HandlerFunc(s.handleCreateProject)))
	mux.Handle("GET "+apiPrefix+"/projects/{id}", s.auth(http.HandlerFunc(s.handleGetProject)))
	mux.Handle("PUT "+apiPrefix+"/projects/{id}", s.auth(http.HandlerFunc(s.handleUpdateProject)))
	mux.Handle("DELETE "+apiPrefix+"/projects/{id}", s.auth(http.HandlerFunc(s.handleDeleteProject)))

	mux.Handle("GET "+apiPrefix+"/dashboard/stats", s.auth(http.HandlerFunc(s.handleStats)))
	mux.Handle("GET "+apiPrefix+"/dashboard/revenue", s.auth(http.HandlerFunc(s.handleRevenue)))
	mux.Handle("GET "+apiPrefix+"/dashboard/status", s.auth(http.HandlerFunc(s.handleStatusBreakdown)))

	mux.Handle("GET "+apiPrefix+"/time", s.auth(http.HandlerFunc(s.handleListTime)))
	mux.Handle("POST "+apiPrefix+"/time", s.auth(http.HandlerFunc(s.handleCreateTime)))
	mux.Handle("DELETE "+apiPrefix+"/time/{id}", s.auth(http.HandlerFunc(s.handleDeleteTime)))
	mux.Handle("GET "+apiPrefix+"/time/per-day", s.auth(http.HandlerFunc(s.handleTimePerDay)))

	// Outermost first: recover → request-id → log → cors → routes.
	return s.recoverer(s.requestID(s.logger(s.cors(mux))))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": APIVersion})
}

// ---- middleware ----

type ctxKeyRequestID struct{}

// requestID assigns a unique ID to each request, echoes it back in the
// X-Request-ID header, and stores it in the context for log correlation.
// An inbound X-Request-ID is trusted (useful for tracing across services).
func (s *Server) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), ctxKeyRequestID{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyRequestID{}).(string)
	return id
}

func newRequestID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

// recoverer turns panics into a 500 response and an error log instead of
// crashing the process / function instance.
func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.Error("panic recovered",
					slog.Any("error", rec),
					slog.String("request_id", requestIDFrom(r.Context())),
					slog.String("method", r.Method),
					slog.String("path", r.URL.Path),
				)
				writeErr(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.allowOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

func (sr *statusRecorder) Write(b []byte) (int, error) {
	n, err := sr.ResponseWriter.Write(b)
	sr.bytes += n
	return n, err
}

// logger emits one structured log line per request with correlation fields.
func (s *Server) logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		level := slog.LevelInfo
		switch {
		case rec.status >= 500:
			level = slog.LevelError
		case rec.status >= 400:
			level = slog.LevelWarn
		}
		s.log.LogAttrs(r.Context(), level, "http_request",
			slog.String("request_id", requestIDFrom(r.Context())),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", rec.status),
			slog.Int("bytes", rec.bytes),
			slog.Duration("duration", time.Since(start)),
			slog.String("remote", clientIP(r)),
		)
	})
}

// clientIP returns the best-effort client IP, honoring X-Forwarded-For set by
// the platform proxy (Vercel) ahead of RemoteAddr.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	return r.RemoteAddr
}

// ---- helpers ----

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// decode reads a JSON body into v, writing a 400 and returning false on failure.
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return false
	}
	return true
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}
