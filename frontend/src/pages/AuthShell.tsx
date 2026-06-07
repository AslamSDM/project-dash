import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 13h4l2 6 4-14 2 8h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-bold">PulseBoard</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-snug">
            Keep every client project on pulse.
          </h2>
          <p className="mt-4 max-w-sm text-slate-400">
            Revenue charts, project tracking, and a clean workspace built for people who bill by the
            hour.
          </p>
        </div>
        <p className="text-sm text-slate-500">Go + React · open dashboard demo</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Link to="/" className="mb-8 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 13h4l2 6 4-14 2 8h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-lg font-bold text-slate-900">PulseBoard</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
