import type {
  AuthResponse,
  DashboardStats,
  DayMinutes,
  Project,
  RevenuePoint,
  StatusCount,
  TimeEntry,
  User,
} from './types'

// API base path. Versioned (/api/v1) so the client is pinned to a specific
// backend contract. Overridable via VITE_API_BASE for non-default setups.
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1'

const TOKEN_KEY = 'pulseboard_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    tokenStore.clear()
  }
  if (res.status === 204) {
    return undefined as T
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? 'Request failed')
  }
  return data as T
}

export const api = {
  // auth
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),

  // profile
  updateProfile: (name: string, currentPassword?: string, newPassword?: string) =>
    request<User>('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        name,
        currentPassword: currentPassword ?? '',
        newPassword: newPassword ?? '',
      }),
    }),

  // projects
  listProjects: () => request<Project[]>('/projects'),
  createProject: (p: Partial<Project>) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(p) }),
  updateProject: (id: number, p: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(p) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // dashboard
  stats: () => request<DashboardStats>('/dashboard/stats'),
  revenue: () => request<RevenuePoint[]>('/dashboard/revenue'),
  statusBreakdown: () => request<StatusCount[]>('/dashboard/status'),

  // time tracking
  listTime: (projectId?: number) =>
    request<TimeEntry[]>(`/time${projectId ? `?projectId=${projectId}` : ''}`),
  createTime: (e: { projectId: number; description: string; minutes: number; date: string }) =>
    request<TimeEntry>('/time', { method: 'POST', body: JSON.stringify(e) }),
  deleteTime: (id: number) => request<void>(`/time/${id}`, { method: 'DELETE' }),
  timePerDay: () => request<DayMinutes[]>('/time/per-day'),
}
