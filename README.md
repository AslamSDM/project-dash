# PulseBoard

A small full-stack dashboard for freelancers and small agencies to track
**client projects** and **revenue** in one clean view.

- **Backend:** Go (standard library `net/http` router, SQLite, JWT auth, bcrypt)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Recharts
- **Auth:** email/password → JWT (stored client-side), all data scoped per user
- **On signup:** the account is seeded with demo projects + revenue so the
  dashboard is never empty.

## Pages

| Route            | Description                                              |
| ---------------- | ------------------------------------------------------- |
| `/`              | Marketing landing page                                  |
| `/login`         | Sign in                                                 |
| `/register`      | Create account (auto-seeds demo data)                   |
| `/app`           | Dashboard — stat cards, revenue area chart, status pie  |
| `/app/projects`  | Project list with filter, search, and full CRUD         |
| `/app/time`      | Time tracking — log hours, weekly bar chart, day totals |
| `/app/profile`   | View account, update name / password                    |

## Quick start

Requires **Go 1.26+** and **Node 20+**.

```bash
./dev.sh          # starts API (:8080) and web (:5173) together
```

Then open http://localhost:5173 and click **Start for free**.

### Run the parts separately

```bash
# Terminal 1 — API
cd backend
go run .                       # listens on :8080

# Terminal 2 — web
cd frontend
npm install                    # first time only
npm run dev                    # listens on :5173, proxies /api → :8080
```

## Configuration (backend)

Environment variables (see `backend/.env.example`):

| Var           | Default                  | Purpose                          |
| ------------- | ------------------------ | -------------------------------- |
| `PORT`        | `8080`                   | API listen port                  |
| `DB_PATH`     | `pulseboard.db`          | SQLite file path                 |
| `JWT_SECRET`  | `dev-secret-change-me`   | HMAC signing key — **change it** |
| `CORS_ORIGIN` | `http://localhost:5173`  | Allowed browser origin           |

## API

All `/api/*` routes return JSON. Protected routes require
`Authorization: Bearer <token>`.

```
POST   /api/auth/register     { name, email, password } → { token, user }
POST   /api/auth/login        { email, password }       → { token, user }
GET    /api/auth/me                                      → user

GET    /api/profile                                      → user
PUT    /api/profile           { name, currentPassword?, newPassword? } → user
       # changing the password requires the correct currentPassword

GET    /api/projects                                     → Project[]
POST   /api/projects          Project                    → Project
GET    /api/projects/{id}                                → Project
PUT    /api/projects/{id}     Project                    → Project
DELETE /api/projects/{id}                                → 204

GET    /api/dashboard/stats                              → { totalRevenue, activeProjects, completionRate, totalProjects }
GET    /api/dashboard/revenue                            → { month, amount }[]
GET    /api/dashboard/status                             → { status, count }[]

GET    /api/time[?projectId=N]                           → TimeEntry[]
POST   /api/time            { projectId, description, minutes, date } → TimeEntry
DELETE /api/time/{id}                                    → 204
GET    /api/time/per-day                                 → { date, minutes }[]   (last 7 days)
```

### Password security

Passwords are hashed with **bcrypt** (`golang.org/x/crypto/bcrypt`), which
generates a unique random salt per password and stores it inside the hash — so
credentials are always salted + hashed, never reversible. Changing a password
requires submitting the correct current password, which is verified with a
constant-time bcrypt comparison before the new hash is written.

## Layout

```
backend/
  main.go                  # config, server lifecycle, graceful shutdown
  internal/
    models/                # shared structs
    store/                 # SQLite: migrations, queries, demo seed
    api/                   # router, middleware (CORS/log/auth), handlers
frontend/
  src/
    lib/                   # api client, types, formatting helpers
    context/AuthContext    # session state
    components/            # Layout, ProtectedRoute, ProjectModal, UI kit
    pages/                 # Landing, Login, Register, Dashboard, Projects, Profile
```

## Notes / production hardening

- SQLite runs single-connection to avoid write locks; swap the driver/DSN in
  `store.Open` for Postgres in production.
- Tokens live in `localStorage` for simplicity; for stricter security move to
  httpOnly cookies and add CSRF protection.
- Set a strong `JWT_SECRET` and a real `CORS_ORIGIN` before deploying.
```
# project-dash
