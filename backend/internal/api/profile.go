package api

import (
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func (s *Server) handleGetProfile(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, currentUser(r))
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name            string `json:"name"`
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !decode(w, r, &in) {
		return
	}
	user := currentUser(r)
	name := strings.TrimSpace(in.Name)
	if name == "" {
		writeErr(w, http.StatusBadRequest, "name is required")
		return
	}
	var hash string
	if in.NewPassword != "" {
		// Changing the password requires proving knowledge of the current one.
		if in.CurrentPassword == "" {
			writeErr(w, http.StatusBadRequest, "current password is required to set a new password")
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.CurrentPassword)) != nil {
			writeErr(w, http.StatusUnauthorized, "current password is incorrect")
			return
		}
		if len(in.NewPassword) < 6 {
			writeErr(w, http.StatusBadRequest, "new password must be at least 6 characters")
			return
		}
		if in.NewPassword == in.CurrentPassword {
			writeErr(w, http.StatusBadRequest, "new password must be different from the current one")
			return
		}
		// bcrypt generates a unique salt per hash and stores it inside the hash
		// string, so passwords are always stored salted + hashed.
		h, err := bcrypt.GenerateFromPassword([]byte(in.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "could not hash password")
			return
		}
		hash = string(h)
	}
	if err := s.store.UpdateProfile(r.Context(), user.ID, name, hash); err != nil {
		writeErr(w, http.StatusInternalServerError, "could not update profile")
		return
	}
	updated, err := s.store.UserByID(r.Context(), user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load profile")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
