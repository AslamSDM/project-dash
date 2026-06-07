package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"pulseboard/internal/models"
	"pulseboard/internal/store"
)

var validStatus = map[string]bool{"active": true, "on_hold": true, "completed": true}

func pathID(r *http.Request) (int64, error) {
	return strconv.ParseInt(r.PathValue("id"), 10, 64)
}

type projectInput struct {
	Name     string  `json:"name"`
	Client   string  `json:"client"`
	Status   string  `json:"status"`
	Budget   float64 `json:"budget"`
	Spent    float64 `json:"spent"`
	Progress int     `json:"progress"`
	DueDate  string  `json:"dueDate"`
}

// validate normalizes and checks the input, returning a model and error message.
func (in projectInput) toModel() (models.Project, string) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return models.Project{}, "name is required"
	}
	status := in.Status
	if status == "" {
		status = "active"
	}
	if !validStatus[status] {
		return models.Project{}, "status must be active, on_hold, or completed"
	}
	if in.Progress < 0 || in.Progress > 100 {
		return models.Project{}, "progress must be between 0 and 100"
	}
	if in.Budget < 0 || in.Spent < 0 {
		return models.Project{}, "budget and spent must be non-negative"
	}
	return models.Project{
		Name:     name,
		Client:   strings.TrimSpace(in.Client),
		Status:   status,
		Budget:   in.Budget,
		Spent:    in.Spent,
		Progress: in.Progress,
		DueDate:  in.DueDate,
	}, ""
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	list, err := s.store.ListProjects(r.Context(), currentUser(r).ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not list projects")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	p, err := s.store.GetProject(r.Context(), currentUser(r).ID, id)
	if err != nil {
		notFoundOr500(w, err, "could not load project")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var in projectInput
	if !decode(w, r, &in) {
		return
	}
	m, msg := in.toModel()
	if msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	p, err := s.store.CreateProject(r.Context(), currentUser(r).ID, m)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not create project")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in projectInput
	if !decode(w, r, &in) {
		return
	}
	m, msg := in.toModel()
	if msg != "" {
		writeErr(w, http.StatusBadRequest, msg)
		return
	}
	p, err := s.store.UpdateProject(r.Context(), currentUser(r).ID, id, m)
	if err != nil {
		notFoundOr500(w, err, "could not update project")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.store.DeleteProject(r.Context(), currentUser(r).ID, id); err != nil {
		notFoundOr500(w, err, "could not delete project")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func notFoundOr500(w http.ResponseWriter, err error, msg string) {
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	writeErr(w, http.StatusInternalServerError, msg)
}
