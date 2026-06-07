import type { Status } from './types'

export const currency = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

export const statusLabel: Record<Status, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
}

// Tailwind classes for status pills.
export const statusClasses: Record<Status, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  on_hold: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  completed: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

// Hex colors for charts, keyed by status.
export const statusColor: Record<Status, string> = {
  active: '#10b981',
  on_hold: '#f59e0b',
  completed: '#94a3b8',
}

// Recallit-language status pill styling (CSS-var driven), keyed by status.
export const statusStyle: Record<Status, { color: string; soft: string; ink: string }> = {
  active: { color: 'var(--moss)', soft: 'var(--moss-soft)', ink: '#3C6B1E' },
  on_hold: { color: 'var(--teal)', soft: 'var(--teal-soft)', ink: '#8A5A00' },
  completed: { color: 'var(--ink-3)', soft: 'var(--paper-3)', ink: 'var(--ink-2)' },
}

// Recallit donut/segment color per status.
export const statusToken: Record<Status, string> = {
  active: 'var(--moss)',
  on_hold: 'var(--teal)',
  completed: 'var(--ink-3)',
}

// Deterministic tag color per project, drawn from the crayon palette.
const PROJECT_PALETTE = [
  'var(--amber)',
  'var(--teal)',
  'var(--coral)',
  'var(--moss)',
  'var(--rose)',
  'var(--amber-deep)',
]
export const projectColor = (id: number) => PROJECT_PALETTE[Math.abs(id) % PROJECT_PALETTE.length]

// Short due-date label, e.g. "Jun 18". Falls back to em dash on empty/invalid.
export const shortDate = (iso: string) => {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
