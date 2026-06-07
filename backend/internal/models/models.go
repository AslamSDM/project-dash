package models

import "time"

// User is an account in PulseBoard.
type User struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	AvatarColor  string    `json:"avatarColor"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Project is a client engagement owned by a user.
type Project struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"-"`
	Name      string    `json:"name"`
	Client    string    `json:"client"`
	Status    string    `json:"status"` // active | on_hold | completed
	Budget    float64   `json:"budget"`
	Spent     float64   `json:"spent"`
	Progress  int       `json:"progress"` // 0-100
	DueDate   string    `json:"dueDate"`  // YYYY-MM-DD
	CreatedAt time.Time `json:"createdAt"`
}

// TimeEntry is a logged block of work against a project.
type TimeEntry struct {
	ID          int64     `json:"id"`
	UserID      int64     `json:"-"`
	ProjectID   int64     `json:"projectId"`
	ProjectName string    `json:"projectName"`
	Description string    `json:"description"`
	Minutes     int       `json:"minutes"`
	Date        string    `json:"date"` // YYYY-MM-DD
	CreatedAt   time.Time `json:"createdAt"`
}

// DayMinutes is one bar in the "hours per day" chart.
type DayMinutes struct {
	Date    string `json:"date"` // YYYY-MM-DD
	Minutes int    `json:"minutes"`
}

// RevenueEntry is a monthly revenue data point used for charts.
type RevenueEntry struct {
	Month  string  `json:"month"` // e.g. "Jan"
	Amount float64 `json:"amount"`
}

// DashboardStats is the summary card payload.
type DashboardStats struct {
	TotalRevenue   float64 `json:"totalRevenue"`
	ActiveProjects int     `json:"activeProjects"`
	CompletionRate int     `json:"completionRate"`
	TotalProjects  int     `json:"totalProjects"`
}

// StatusCount feeds the project-status pie chart.
type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}
