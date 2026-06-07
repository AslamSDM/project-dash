package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"pulseboard/internal/models"
)

func (s *Server) handleListTime(w http.ResponseWriter, r *http.Request) {
	var projectID int64
	if v := r.URL.Query().Get("projectId"); v != "" {
		projectID, _ = strconv.ParseInt(v, 10, 64)
	}
	list, err := s.store.ListTimeEntries(r.Context(), currentUser(r).ID, projectID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not list time entries")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleCreateTime(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ProjectID   int64  `json:"projectId"`
		Description string `json:"description"`
		Minutes     int    `json:"minutes"`
		Date        string `json:"date"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.ProjectID <= 0 {
		writeErr(w, http.StatusBadRequest, "projectId is required")
		return
	}
	if in.Minutes <= 0 {
		writeErr(w, http.StatusBadRequest, "minutes must be greater than 0")
		return
	}
	if in.Date == "" {
		in.Date = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", in.Date); err != nil {
		writeErr(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
		return
	}
	entry, err := s.store.CreateTimeEntry(r.Context(), currentUser(r).ID, models.TimeEntry{
		ProjectID:   in.ProjectID,
		Description: strings.TrimSpace(in.Description),
		Minutes:     in.Minutes,
		Date:        in.Date,
	})
	if err != nil {
		// CreateTimeEntry returns ErrNotFound when the project isn't the user's.
		notFoundOr500(w, err, "could not create time entry")
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handleDeleteTime(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.DeleteTimeEntry(r.Context(), currentUser(r).ID, id); err != nil {
		notFoundOr500(w, err, "could not delete time entry")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleTimePerDay(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.MinutesPerDay(r.Context(), currentUser(r).ID, 7)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load time chart")
		return
	}
	writeJSON(w, http.StatusOK, data)
}
