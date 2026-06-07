package api

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"pulseboard/internal/models"
	"pulseboard/internal/store"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type ctxKey string

const userCtxKey ctxKey = "user"

var avatarColors = []string{"#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"}

// auth is middleware that validates the bearer JWT and loads the user.
func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := bearerToken(r)
		if tok == "" {
			writeErr(w, http.StatusUnauthorized, "missing token")
			return
		}
		claims := jwt.RegisteredClaims{}
		parsed, err := jwt.ParseWithClaims(tok, &claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return s.jwtSecret, nil
		})
		if err != nil || !parsed.Valid {
			writeErr(w, http.StatusUnauthorized, "invalid token")
			return
		}
		id, err := strconv.ParseInt(claims.Subject, 10, 64)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "invalid token subject")
			return
		}
		user, err := s.store.UserByID(r.Context(), id)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "user not found")
			return
		}
		ctx := context.WithValue(r.Context(), userCtxKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func currentUser(r *http.Request) *models.User {
	u, _ := r.Context().Value(userCtxKey).(*models.User)
	return u
}

func (s *Server) issueToken(userID int64) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(userID, 10),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}

type authResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if in.Name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	if _, err := mail.ParseAddress(in.Email); err != nil {
		writeErr(w, http.StatusBadRequest, "valid email is required")
		return
	}
	if len(in.Password) < 6 {
		writeErr(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}
	if _, err := s.store.UserByEmail(r.Context(), in.Email); err == nil {
		writeErr(w, http.StatusConflict, "email already registered")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not hash password")
		return
	}
	color := avatarColors[int(time.Now().UnixNano())%len(avatarColors)]
	user, err := s.store.CreateUser(r.Context(), in.Name, in.Email, string(hash), color)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create user")
		return
	}
	// Seed demo data so the dashboard is populated on first login.
	if err := s.store.SeedDemo(r.Context(), user.ID); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not seed demo data")
		return
	}
	token, err := s.issueToken(user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	writeJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	user, err := s.store.UserByEmail(r.Context(), in.Email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeErr(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)) != nil {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := s.issueToken(user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not issue token")
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, currentUser(r))
}
