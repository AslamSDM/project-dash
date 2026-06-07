import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react'
import { statusLabel, statusStyle } from '../lib/format'
import type { Status } from '../lib/types'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 animate-spin text-current ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

type IconC = ComponentType<{ s?: number; c?: string }>

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'
  loading?: boolean
  full?: boolean
  icon?: IconC
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  full,
  icon: IconEl,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}${full ? ' btn-full' : ''} ${className}`}
      data-size={size}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="btn-spinner" />}
      {!loading && IconEl && <IconEl s={size === 'sm' ? 16 : 18} c="currentColor" />}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pb-card ${className}`}>{children}</div>
}

export function StatusPill({ status }: { status: Status }) {
  const s = statusStyle[status]
  return (
    <span className="pb-status" style={{ background: s.soft, color: s.ink }}>
      <span className="pb-status-dot" style={{ background: s.color }} />
      {statusLabel[status]}
    </span>
  )
}

export function Avatar({
  initials,
  size = 40,
  color = 'var(--amber)',
}: {
  initials: string
  size?: number
  color?: string
}) {
  return (
    <span className="pb-avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {initials}
    </span>
  )
}

export function Field({
  label,
  children,
  hint,
  full,
}: {
  label?: string
  children: ReactNode
  hint?: string
  full?: boolean
}) {
  return (
    <label className="pb-field" style={full ? { gridColumn: '1 / -1' } : undefined}>
      {label && <span className="pb-field-label">{label}</span>}
      {children}
      {hint && <span className="pb-field-hint">{hint}</span>}
    </label>
  )
}

export function ProgressBar({
  value,
  color = 'var(--amber)',
  height = 7,
}: {
  value: number
  color?: string
  height?: number
}) {
  return (
    <div className="pb-progress" style={{ height }}>
      <div className="pb-progress-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export const inputClass = 'input pb-input'
