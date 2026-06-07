import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const features = [
  {
    title: 'Revenue at a glance',
    body: 'Track monthly income across every client with live charts that update as you log work.',
    icon: '📈',
  },
  {
    title: 'Projects under control',
    body: 'Budgets, progress, deadlines and status — one tidy board for your whole pipeline.',
    icon: '🗂️',
  },
  {
    title: 'Built for focus',
    body: 'A fast, clean dashboard with zero clutter so you spend time on work, not admin.',
    icon: '⚡',
  },
]

export default function Landing() {
  const { user } = useAuth()
  const cta = user ? '/app' : '/register'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 13h4l2 6 4-14 2 8h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-bold text-slate-900">PulseBoard</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <Link
            to={cta}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            {user ? 'Open app' : 'Get started'}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-white" />
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
            For freelancers & small agencies
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            The dashboard that keeps your client work{' '}
            <span className="text-brand-600">on pulse</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Manage projects, monitor revenue, and see your whole business in one clean view —
            without the spreadsheet chaos.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to={cta}
              className="rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {user ? 'Go to dashboard' : 'Start for free'}
            </Link>
            <Link
              to="/login"
              className="rounded-xl px-6 py-3 text-base font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Live demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">No credit card. Demo data ready on signup.</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} PulseBoard. Built with Go + React.
      </footer>
    </div>
  )
}
