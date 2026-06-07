export type Status = 'active' | 'on_hold' | 'completed'

export interface User {
  id: number
  name: string
  email: string
  role: string
  avatarColor: string
  createdAt: string
}

export interface Project {
  id: number
  name: string
  client: string
  status: Status
  budget: number
  spent: number
  progress: number
  dueDate: string
  createdAt: string
}

export interface DashboardStats {
  totalRevenue: number
  activeProjects: number
  completionRate: number
  totalProjects: number
}

export interface RevenuePoint {
  month: string
  amount: number
}

export interface StatusCount {
  status: Status
  count: number
}

export interface TimeEntry {
  id: number
  projectId: number
  projectName: string
  description: string
  minutes: number
  date: string
  createdAt: string
}

export interface DayMinutes {
  date: string
  minutes: number
}

export interface AuthResponse {
  token: string
  user: User
}
