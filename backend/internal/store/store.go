package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"pulseboard/internal/models"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// ErrNotFound is returned when a row does not exist (or is not owned by the caller).
var ErrNotFound = errors.New("not found")

// Store wraps the database connection and all queries.
type Store struct {
	db *sql.DB
}

// Open opens the Postgres database at dsn, runs migrations, and returns a Store.
// dsn is a standard Postgres connection string (e.g. the DATABASE_URL provided
// by Neon / Vercel Postgres).
func Open(dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	// Serverless-friendly pool: keep it small so we don't exhaust Postgres
	// connection limits across many warm function instances.
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(2)
	db.SetConnMaxIdleTime(30 * time.Second)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS users (
	id            BIGSERIAL PRIMARY KEY,
	name          TEXT NOT NULL,
	email         TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	role          TEXT NOT NULL DEFAULT 'member',
	avatar_color  TEXT NOT NULL DEFAULT '#6366f1',
	created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
	id         BIGSERIAL PRIMARY KEY,
	user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	name       TEXT NOT NULL,
	client     TEXT NOT NULL DEFAULT '',
	status     TEXT NOT NULL DEFAULT 'active',
	budget     DOUBLE PRECISION NOT NULL DEFAULT 0,
	spent      DOUBLE PRECISION NOT NULL DEFAULT 0,
	progress   INTEGER NOT NULL DEFAULT 0,
	due_date   TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue (
	id      BIGSERIAL PRIMARY KEY,
	user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	month   TEXT NOT NULL,
	amount  DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS time_entries (
	id          BIGSERIAL PRIMARY KEY,
	user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	description TEXT NOT NULL DEFAULT '',
	minutes     INTEGER NOT NULL DEFAULT 0,
	date        TEXT NOT NULL,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_user  ON revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_time_user     ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_project  ON time_entries(project_id);
`)
	return err
}

// ---- Users ----

// CreateUser inserts a new user and returns it.
func (s *Store) CreateUser(ctx context.Context, name, email, passwordHash, color string) (*models.User, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO users (name, email, password_hash, avatar_color) VALUES ($1, $2, $3, $4) RETURNING id`,
		name, email, passwordHash, color).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.UserByID(ctx, id)
}

// UserByID looks up a user by primary key.
func (s *Store) UserByID(ctx context.Context, id int64) (*models.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT id, name, email, password_hash, role, avatar_color, created_at FROM users WHERE id = $1`, id))
}

// UserByEmail looks up a user by email (used for login).
func (s *Store) UserByEmail(ctx context.Context, email string) (*models.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT id, name, email, password_hash, role, avatar_color, created_at FROM users WHERE email = $1`, email))
}

func (s *Store) scanUser(row *sql.Row) (*models.User, error) {
	var u models.User
	if err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.AvatarColor, &u.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// UpdateProfile updates the user's name and optionally password hash.
func (s *Store) UpdateProfile(ctx context.Context, id int64, name, passwordHash string) error {
	if passwordHash != "" {
		_, err := s.db.ExecContext(ctx, `UPDATE users SET name = $1, password_hash = $2 WHERE id = $3`, name, passwordHash, id)
		return err
	}
	_, err := s.db.ExecContext(ctx, `UPDATE users SET name = $1 WHERE id = $2`, name, id)
	return err
}

// ---- Projects ----

// ListProjects returns all projects for a user, newest first.
func (s *Store) ListProjects(ctx context.Context, userID int64) ([]models.Project, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, name, client, status, budget, spent, progress, due_date, created_at
		 FROM projects WHERE user_id = $1 ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Project{}
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.Client, &p.Status, &p.Budget, &p.Spent, &p.Progress, &p.DueDate, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetProject returns one project owned by userID.
func (s *Store) GetProject(ctx context.Context, userID, id int64) (*models.Project, error) {
	var p models.Project
	err := s.db.QueryRowContext(ctx,
		`SELECT id, user_id, name, client, status, budget, spent, progress, due_date, created_at
		 FROM projects WHERE id = $1 AND user_id = $2`, id, userID).
		Scan(&p.ID, &p.UserID, &p.Name, &p.Client, &p.Status, &p.Budget, &p.Spent, &p.Progress, &p.DueDate, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

// CreateProject inserts a project for userID.
func (s *Store) CreateProject(ctx context.Context, userID int64, p models.Project) (*models.Project, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO projects (user_id, name, client, status, budget, spent, progress, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		userID, p.Name, p.Client, p.Status, p.Budget, p.Spent, p.Progress, p.DueDate).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetProject(ctx, userID, id)
}

// UpdateProject updates a project owned by userID.
func (s *Store) UpdateProject(ctx context.Context, userID, id int64, p models.Project) (*models.Project, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE projects SET name = $1, client = $2, status = $3, budget = $4, spent = $5, progress = $6, due_date = $7
		 WHERE id = $8 AND user_id = $9`,
		p.Name, p.Client, p.Status, p.Budget, p.Spent, p.Progress, p.DueDate, id, userID)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return s.GetProject(ctx, userID, id)
}

// DeleteProject removes a project owned by userID.
func (s *Store) DeleteProject(ctx context.Context, userID, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM projects WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- Dashboard ----

// Stats computes summary cards for a user.
func (s *Store) Stats(ctx context.Context, userID int64) (*models.DashboardStats, error) {
	var st models.DashboardStats
	if err := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount),0) FROM revenue WHERE user_id = $1`, userID).Scan(&st.TotalRevenue); err != nil {
		return nil, err
	}
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM projects WHERE user_id = $1`, userID).Scan(&st.TotalProjects); err != nil {
		return nil, err
	}
	if err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM projects WHERE user_id = $1 AND status = 'active'`, userID).Scan(&st.ActiveProjects); err != nil {
		return nil, err
	}
	var avg sql.NullFloat64
	if err := s.db.QueryRowContext(ctx,
		`SELECT AVG(progress) FROM projects WHERE user_id = $1`, userID).Scan(&avg); err != nil {
		return nil, err
	}
	if avg.Valid {
		st.CompletionRate = int(avg.Float64)
	}
	return &st, nil
}

// Revenue returns the monthly revenue series for a user, in insertion order.
func (s *Store) Revenue(ctx context.Context, userID int64) ([]models.RevenueEntry, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT month, amount FROM revenue WHERE user_id = $1 ORDER BY id ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.RevenueEntry{}
	for rows.Next() {
		var e models.RevenueEntry
		if err := rows.Scan(&e.Month, &e.Amount); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// StatusBreakdown returns project counts grouped by status.
func (s *Store) StatusBreakdown(ctx context.Context, userID int64) ([]models.StatusCount, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM projects WHERE user_id = $1 GROUP BY status`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.StatusCount{}
	for rows.Next() {
		var c models.StatusCount
		if err := rows.Scan(&c.Status, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ---- Time entries ----

// ListTimeEntries returns a user's time entries (optionally filtered by
// projectID when > 0), newest first, with the project name joined in.
func (s *Store) ListTimeEntries(ctx context.Context, userID, projectID int64) ([]models.TimeEntry, error) {
	query := `SELECT t.id, t.user_id, t.project_id, p.name, t.description, t.minutes, t.date, t.created_at
		FROM time_entries t JOIN projects p ON p.id = t.project_id
		WHERE t.user_id = $1`
	args := []any{userID}
	if projectID > 0 {
		query += ` AND t.project_id = $2`
		args = append(args, projectID)
	}
	query += ` ORDER BY t.date DESC, t.id DESC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.TimeEntry{}
	for rows.Next() {
		var e models.TimeEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.ProjectID, &e.ProjectName, &e.Description, &e.Minutes, &e.Date, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// CreateTimeEntry logs time against a project the user owns.
func (s *Store) CreateTimeEntry(ctx context.Context, userID int64, e models.TimeEntry) (*models.TimeEntry, error) {
	// Ensure the project belongs to the user before inserting.
	if _, err := s.GetProject(ctx, userID, e.ProjectID); err != nil {
		return nil, err
	}
	var id int64
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO time_entries (user_id, project_id, description, minutes, date) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		userID, e.ProjectID, e.Description, e.Minutes, e.Date).Scan(&id)
	if err != nil {
		return nil, err
	}
	var out models.TimeEntry
	err = s.db.QueryRowContext(ctx,
		`SELECT t.id, t.user_id, t.project_id, p.name, t.description, t.minutes, t.date, t.created_at
		 FROM time_entries t JOIN projects p ON p.id = t.project_id WHERE t.id = $1`, id).
		Scan(&out.ID, &out.UserID, &out.ProjectID, &out.ProjectName, &out.Description, &out.Minutes, &out.Date, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// DeleteTimeEntry removes a time entry owned by the user.
func (s *Store) DeleteTimeEntry(ctx context.Context, userID, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM time_entries WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// MinutesPerDay returns total logged minutes for each of the last `days` days,
// including days with zero minutes, oldest first.
func (s *Store) MinutesPerDay(ctx context.Context, userID int64, days int) ([]models.DayMinutes, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT date, SUM(minutes) FROM time_entries WHERE user_id = $1 GROUP BY date`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byDate := map[string]int{}
	for rows.Next() {
		var d string
		var m int
		if err := rows.Scan(&d, &m); err != nil {
			return nil, err
		}
		byDate[d] = m
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]models.DayMinutes, 0, days)
	today := time.Now()
	for i := days - 1; i >= 0; i-- {
		d := today.AddDate(0, 0, -i).Format("2006-01-02")
		out = append(out, models.DayMinutes{Date: d, Minutes: byDate[d]})
	}
	return out, nil
}

// SeedDemo populates a fresh user with sample projects and revenue so the
// dashboard is never empty on first login.
func (s *Store) SeedDemo(ctx context.Context, userID int64) error {
	months := []struct {
		m string
		a float64
	}{
		{"Jan", 8200}, {"Feb", 9600}, {"Mar", 7400}, {"Apr", 11200},
		{"May", 13800}, {"Jun", 12500}, {"Jul", 15100}, {"Aug", 16900},
	}
	for _, mo := range months {
		if _, err := s.db.ExecContext(ctx,
			`INSERT INTO revenue (user_id, month, amount) VALUES ($1, $2, $3)`, userID, mo.m, mo.a); err != nil {
			return err
		}
	}
	now := time.Now()
	demo := []models.Project{
		{Name: "Acme Corp Rebrand", Client: "Acme Corp", Status: "active", Budget: 24000, Spent: 14500, Progress: 62, DueDate: now.AddDate(0, 1, 5).Format("2006-01-02")},
		{Name: "FinTrack Mobile App", Client: "FinTrack", Status: "active", Budget: 48000, Spent: 31000, Progress: 71, DueDate: now.AddDate(0, 2, 0).Format("2006-01-02")},
		{Name: "Bloom E-commerce", Client: "Bloom & Co", Status: "on_hold", Budget: 18000, Spent: 6200, Progress: 28, DueDate: now.AddDate(0, 3, 10).Format("2006-01-02")},
		{Name: "Nimbus Marketing Site", Client: "Nimbus", Status: "completed", Budget: 12000, Spent: 11800, Progress: 100, DueDate: now.AddDate(0, -1, 0).Format("2006-01-02")},
		{Name: "Vertex Dashboard", Client: "Vertex Labs", Status: "completed", Budget: 30000, Spent: 28500, Progress: 100, DueDate: now.AddDate(0, -2, 0).Format("2006-01-02")},
	}
	var ids []int64
	for _, p := range demo {
		created, err := s.CreateProject(ctx, userID, p)
		if err != nil {
			return fmt.Errorf("seed project: %w", err)
		}
		ids = append(ids, created.ID)
	}

	// A week of sample time entries across the active projects.
	type te struct {
		proj    int // index into ids
		daysAgo int
		min     int
		desc    string
	}
	entries := []te{
		{0, 0, 150, "Logo concepts & moodboard"},
		{1, 0, 90, "API integration"},
		{0, 1, 120, "Client review call + revisions"},
		{1, 1, 180, "Auth flow implementation"},
		{2, 2, 60, "Discovery notes"},
		{1, 3, 210, "Checkout screens"},
		{0, 4, 95, "Brand guidelines draft"},
		{1, 5, 140, "Bug fixes"},
	}
	for _, e := range entries {
		date := now.AddDate(0, 0, -e.daysAgo).Format("2006-01-02")
		if _, err := s.CreateTimeEntry(ctx, userID, models.TimeEntry{
			ProjectID: ids[e.proj], Description: e.desc, Minutes: e.min, Date: date,
		}); err != nil {
			return fmt.Errorf("seed time entry: %w", err)
		}
	}
	return nil
}
