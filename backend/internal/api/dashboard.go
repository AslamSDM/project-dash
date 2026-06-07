package api

import "net/http"

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Stats(r.Context(), currentUser(r).ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not compute stats")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleRevenue(w http.ResponseWriter, r *http.Request) {
	rev, err := s.store.Revenue(r.Context(), currentUser(r).ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load revenue")
		return
	}
	writeJSON(w, http.StatusOK, rev)
}

func (s *Server) handleStatusBreakdown(w http.ResponseWriter, r *http.Request) {
	b, err := s.store.StatusBreakdown(r.Context(), currentUser(r).ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "could not load status breakdown")
		return
	}
	writeJSON(w, http.StatusOK, b)
}
