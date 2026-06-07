import { useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { DayMinutes, Project, TimeEntry } from '../lib/types'
import { Button, Card, Field, inputClass, Spinner } from '../components/ui'
import { BarChart } from '../components/charts'
import { Icon } from '../components/icons'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const weekday = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })

const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export default function TimeTracking() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [perDay, setPerDay] = useState<DayMinutes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ projectId: '', note: '', hours: '' })

  const load = () =>
    Promise.all([api.listTime(), api.listProjects(), api.timePerDay()]).then(([t, p, d]) => {
      setEntries(t)
      setProjects(p)
      setPerDay(d)
      if (!form.projectId && p.length) setForm((f) => ({ ...f, projectId: String(p[0].id) }))
    })

  useEffect(() => {
    load()
      .catch(() => setError('Could not load time data'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chartData = useMemo(
    () => perDay.map((d) => ({ d: weekday(d.date), h: +(d.minutes / 60).toFixed(2) })),
    [perDay],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return [...map.entries()]
  }, [entries])

  const weekTotal = perDay.reduce((s, d) => s + d.minutes, 0) / 60

  const submit = async () => {
    setError('')
    const minutes = Math.round((Number(form.hours) || 0) * 60)
    if (!form.projectId) return setError('Pick a project')
    if (minutes <= 0) return setError('Enter hours greater than 0')
    setSaving(true)
    try {
      await api.createTime({
        projectId: Number(form.projectId),
        description: form.note,
        minutes,
        date: today(),
      })
      setForm((f) => ({ ...f, note: '', hours: '' }))
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log time')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await api.deleteTime(id)
      await load()
    } catch {
      setError('Could not delete entry')
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" style={{ color: 'var(--amber)' }}>
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="pb-page pb-time">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="pb-time-grid">
        <Card className="pb-panel pb-log-card">
          <p className="pb-panel-eyebrow">Log time</p>
          <h3 className="pb-panel-title">What did you work on?</h3>
          <div className="pb-log-form">
            <Field label="Project">
              <div className="pb-select-wrap">
                <select className={inputClass} value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                  <option value="">Select a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Icon.ChevronDown s={18} c="var(--ink-3)" />
              </div>
            </Field>
            <Field label="Hours">
              <input className={inputClass} type="number" step="0.25" min={0} value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} placeholder="0.0" />
            </Field>
            <Field label="Note" full>
              <input className={inputClass} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Short description" />
            </Field>
            <Button full icon={Icon.Plus} loading={saving} disabled={!form.hours || !form.projectId} onClick={submit}>
              Log entry
            </Button>
          </div>
        </Card>

        <Card className="pb-panel pb-week-card">
          <div className="pb-panel-head">
            <div>
              <p className="pb-panel-eyebrow">This week</p>
              <h3 className="pb-panel-title">{weekTotal.toFixed(1)} hours logged</h3>
            </div>
            <div className="pb-legend">
              <span className="pb-legend-dash" />
              Daily goal · 8h
            </div>
          </div>
          <BarChart data={chartData} goal={8} />
        </Card>
      </div>

      <div className="pb-entries">
        {grouped.length === 0 && (
          <p style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
            No time logged yet — add your first entry above.
          </p>
        )}
        {grouped.map(([date, items]) => {
          const total = items.reduce((a, e) => a + e.minutes, 0) / 60
          return (
            <div key={date} className="pb-day-group">
              <div className="pb-day-head">
                <span className="pb-day-label">{longDate(date)}</span>
                <span className="pb-day-total">
                  <Icon.Clock s={15} c="var(--ink-3)" />
                  {total.toFixed(1)}h
                </span>
              </div>
              {items.map((e) => (
                <div key={e.id} className="pb-entry">
                  <div className="pb-entry-time pb-mono">{clockTime(e.createdAt)}</div>
                  <div className="pb-entry-main">
                    <p className="pb-entry-project">{e.projectName}</p>
                    <p className="pb-entry-note">{e.description || 'No description'}</p>
                  </div>
                  <span className="pb-entry-hours pb-mono">{(e.minutes / 60).toFixed(1)}h</span>
                  <button className="pb-row-btn danger" onClick={() => remove(e.id)} aria-label="Delete">
                    <Icon.Trash s={16} c="var(--ink-2)" />
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
