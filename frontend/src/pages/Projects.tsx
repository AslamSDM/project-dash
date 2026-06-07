import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { currency, projectColor, shortDate, statusLabel } from '../lib/format'
import type { Project, Status } from '../lib/types'
import { Button, Card, ProgressBar, Spinner, StatusPill } from '../components/ui'
import { Icon } from '../components/icons'
import ProjectModal from '../components/ProjectModal'

type Filter = 'all' | Status

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: statusLabel.active },
  { key: 'on_hold', label: statusLabel.on_hold },
  { key: 'completed', label: statusLabel.completed },
]

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null })
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => setError('Could not load projects'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesFilter = filter === 'all' || p.status === filter
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [projects, filter, query])

  const counts: Record<Filter, number> = {
    all: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    on_hold: projects.filter((p) => p.status === 'on_hold').length,
    completed: projects.filter((p) => p.status === 'completed').length,
  }

  const onSaved = (saved: Project) => {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === saved.id)
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
    })
    setModal({ open: false, project: null })
  }

  const onDelete = async (p: Project) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    setDeleting(p.id)
    try {
      await api.deleteProject(p.id)
      setProjects((prev) => prev.filter((x) => x.id !== p.id))
    } catch {
      setError('Could not delete project')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="pb-page">
      <div className="pb-toolbar">
        <div className="pb-tabs">
          {FILTERS.map((f) => (
            <button key={f.key} className={'pb-tab' + (filter === f.key ? ' on' : '')} onClick={() => setFilter(f.key)}>
              {f.label}
              <span className="pb-tab-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="pb-toolbar-right">
          <div className="pb-search">
            <Icon.Search s={18} c="var(--ink-3)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects or clients…" />
          </div>
          <Button icon={Icon.Plus} onClick={() => setModal({ open: true, project: null })}>
            New project
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center" style={{ color: 'var(--amber)' }}>
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <Card className="pb-panel pb-table-card">
          <div className="pb-table">
            <div className="pb-table-head">
              <span>Project</span>
              <span>Status</span>
              <span>Budget</span>
              <span className="pb-th-progress">Progress</span>
              <span>Due</span>
              <span />
            </div>
            {filtered.length === 0 && (
              <div className="pb-empty">
                <span className="pb-empty-mark">
                  <Icon.Folder s={26} c="var(--ink-3)" />
                </span>
                <p className="pb-empty-title">Nothing here yet</p>
                <p className="pb-empty-sub">No projects match this filter. Try another tab or start a new one.</p>
                <Button variant="outline" icon={Icon.Plus} onClick={() => setModal({ open: true, project: null })}>
                  New project
                </Button>
              </div>
            )}
            {filtered.map((p) => (
              <div key={p.id} className="pb-tr">
                <div className="pb-td-project">
                  <span className="pb-recent-swatch" style={{ background: projectColor(p.id) }} />
                  <div>
                    <p className="pb-recent-name">{p.name}</p>
                    <p className="pb-recent-client">{p.client || '—'}</p>
                  </div>
                </div>
                <div>
                  <StatusPill status={p.status} />
                </div>
                <div className="pb-td-budget">
                  <span className="pb-mono">{currency(p.budget)}</span>
                  <span className="pb-td-spent">{currency(p.spent)} spent</span>
                </div>
                <div className="pb-td-progress">
                  <ProgressBar value={p.progress} color={projectColor(p.id)} />
                  <span className="pb-recent-pct">{p.progress}%</span>
                </div>
                <div className="pb-td-due">
                  <Icon.Calendar s={15} c="var(--ink-3)" />
                  <span>{shortDate(p.dueDate)}</span>
                </div>
                <div className="pb-td-actions">
                  <button className="pb-row-btn" onClick={() => setModal({ open: true, project: p })} aria-label="Edit">
                    <Icon.Pencil s={17} c="var(--ink-2)" />
                  </button>
                  <button className="pb-row-btn danger" onClick={() => onDelete(p)} aria-label="Delete" disabled={deleting === p.id}>
                    <Icon.Trash s={17} c="var(--ink-2)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal.open && (
        <ProjectModal project={modal.project} onClose={() => setModal({ open: false, project: null })} onSaved={onSaved} />
      )}
    </div>
  )
}
