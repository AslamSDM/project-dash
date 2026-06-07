import { useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { currency, projectColor, statusToken } from '../lib/format'
import type { DashboardStats, DayMinutes, Project, RevenuePoint, StatusCount } from '../lib/types'
import { Card, ProgressBar, Spinner, StatusPill } from '../components/ui'
import { AreaChart, Donut } from '../components/charts'
import { Icon } from '../components/icons'

type IconC = ComponentType<{ s?: number; c?: string }>

function StatCard({
  label,
  value,
  sub,
  trend,
  trendDir,
  icon: IconEl,
  accent,
}: {
  label: string
  value: string
  sub?: string
  trend?: string
  trendDir?: 'up' | 'down'
  icon: IconC
  accent: { soft: string; color: string }
}) {
  const up = trendDir !== 'down'
  return (
    <Card className="pb-stat">
      <div className="pb-stat-head">
        <span className="pb-stat-icon" style={{ background: accent.soft, color: accent.color }}>
          <IconEl s={20} c="currentColor" />
        </span>
        {trend && (
          <span className={'pb-trend ' + (up ? 'up' : 'down')}>
            {up ? <Icon.TrendUp s={15} /> : <Icon.TrendDown s={15} />}
            {trend}
          </span>
        )}
      </div>
      <p className="pb-stat-value">{value}</p>
      <p className="pb-stat-label">{label}</p>
      {sub && <p className="pb-stat-sub">{sub}</p>}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [revenue, setRevenue] = useState<RevenuePoint[]>([])
  const [breakdown, setBreakdown] = useState<StatusCount[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [perDay, setPerDay] = useState<DayMinutes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.stats(), api.revenue(), api.statusBreakdown(), api.listProjects(), api.timePerDay()])
      .then(([s, r, b, p, d]) => {
        setStats(s)
        setRevenue(r)
        setBreakdown(b)
        setProjects(p)
        setPerDay(d)
      })
      .catch(() => setError('Could not load dashboard data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" style={{ color: 'var(--amber)' }}>
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
  }

  const firstName = (user?.name ?? 'there').split(' ')[0]
  const counts = (s: StatusCount['status']) => breakdown.find((b) => b.status === s)?.count ?? 0
  const active = counts('active')
  const onHold = counts('on_hold')
  const done = counts('completed')
  const weekHours = perDay.reduce((a, d) => a + d.minutes, 0) / 60

  // Revenue trend from the last two monthly points (real data).
  let revTrend: string | undefined
  let revDir: 'up' | 'down' = 'up'
  if (revenue.length >= 2) {
    const a = revenue[revenue.length - 2].amount
    const b = revenue[revenue.length - 1].amount
    if (a > 0) {
      const pct = Math.round(((b - a) / a) * 100)
      revTrend = `${Math.abs(pct)}%`
      revDir = pct < 0 ? 'down' : 'up'
    }
  }

  const recent = projects.slice(0, 5)

  return (
    <div className="pb-page">
      <div className="pb-page-lead">
        <p className="pb-lead-serif">Good to see you, {firstName}.</p>
        <p className="pb-lead-sub">Here's how the studio is moving — {active} active, {onHold} on hold.</p>
      </div>

      <div className="pb-stats-grid">
        <StatCard
          label="Revenue · last period"
          value={currency(stats?.totalRevenue ?? 0)}
          trend={revTrend}
          trendDir={revDir}
          icon={Icon.Wallet}
          accent={{ soft: 'var(--amber-soft)', color: 'var(--amber)' }}
        />
        <StatCard
          label="Active projects"
          value={String(active)}
          sub={`${onHold} on hold · ${done} done`}
          icon={Icon.Layers}
          accent={{ soft: 'var(--moss-soft)', color: '#3C6B1E' }}
        />
        <StatCard
          label="Hours this week"
          value={weekHours.toFixed(1)}
          icon={Icon.Clock}
          accent={{ soft: 'var(--teal-soft)', color: '#8A5A00' }}
        />
        <StatCard
          label="Avg. completion"
          value={`${stats?.completionRate ?? 0}%`}
          sub={`${stats?.totalProjects ?? 0} projects total`}
          icon={Icon.Wallet}
          accent={{ soft: 'var(--coral-soft)', color: '#A11824' }}
        />
      </div>

      <div className="pb-dash-grid">
        <Card className="pb-panel pb-revenue">
          <div className="pb-panel-head">
            <div>
              <p className="pb-panel-eyebrow">Revenue</p>
              <h3 className="pb-panel-title">{currency(stats?.totalRevenue ?? 0)} earned</h3>
            </div>
            <div className="pb-legend">
              <span className="pb-legend-dot" style={{ background: 'var(--amber)' }} />
              Monthly
            </div>
          </div>
          <AreaChart data={revenue.map((r) => ({ m: r.month, v: r.amount }))} />
        </Card>

        <Card className="pb-panel pb-status-panel">
          <div className="pb-panel-head">
            <div>
              <p className="pb-panel-eyebrow">Portfolio</p>
              <h3 className="pb-panel-title">By status</h3>
            </div>
          </div>
          <Donut
            segments={[
              { value: active, color: statusToken.active },
              { value: onHold, color: statusToken.on_hold },
              { value: done, color: statusToken.completed },
            ]}
          />
          <div className="pb-donut-legend">
            <LegendRow color={statusToken.active} label="Active" n={active} />
            <LegendRow color={statusToken.on_hold} label="On hold" n={onHold} />
            <LegendRow color={statusToken.completed} label="Completed" n={done} />
          </div>
        </Card>
      </div>

      <Card className="pb-panel">
        <div className="pb-panel-head">
          <div>
            <p className="pb-panel-eyebrow">Recent</p>
            <h3 className="pb-panel-title">Projects in motion</h3>
          </div>
          <button className="pb-link" onClick={() => navigate('/app/projects')}>
            View all
            <Icon.Chevron s={15} />
          </button>
        </div>
        <div className="pb-recent-list">
          {recent.map((p) => (
            <div key={p.id} className="pb-recent-row" onClick={() => navigate('/app/projects')}>
              <span className="pb-recent-swatch" style={{ background: projectColor(p.id) }} />
              <div className="pb-recent-main">
                <p className="pb-recent-name">{p.name}</p>
                <p className="pb-recent-client">{p.client || '—'}</p>
              </div>
              <div className="pb-recent-progress">
                <ProgressBar value={p.progress} color={projectColor(p.id)} />
                <span className="pb-recent-pct">{p.progress}%</span>
              </div>
              <StatusPill status={p.status} />
              <span className="pb-recent-budget">{currency(p.budget)}</span>
              <Icon.Chevron s={16} c="var(--ink-3)" />
            </div>
          ))}
          {recent.length === 0 && (
            <p style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>No projects yet.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function LegendRow({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <div className="pb-legend-row">
      <span className="pb-legend-dot" style={{ background: color }} />
      <span className="pb-legend-label">{label}</span>
      <span className="pb-legend-n">{n}</span>
    </div>
  )
}
