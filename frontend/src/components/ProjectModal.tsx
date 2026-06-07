import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Project, Status } from '../lib/types'
import { Button, Field, inputClass, ProgressBar } from './ui'
import { Icon } from './icons'

interface Props {
  project: Project | null // null = create mode
  onClose: () => void
  onSaved: (p: Project) => void
}

export default function ProjectModal({ project, onClose, onSaved }: Props) {
  const editing = !!project
  const [form, setForm] = useState({
    name: project?.name ?? '',
    client: project?.client ?? '',
    status: project?.status ?? ('active' as Status),
    budget: project?.budget ?? 0,
    spent: project?.spent ?? 0,
    progress: project?.progress ?? 0,
    dueDate: project?.dueDate ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      const saved = editing ? await api.updateProject(project.id, form) : await api.createProject(form)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-modal-scrim" onMouseDown={onClose}>
      <div className="pb-modal grain" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pb-modal-head">
          <div>
            <p className="pb-panel-eyebrow">{editing ? 'Edit project' : 'New project'}</p>
            <h3 className="pb-modal-title">{editing ? form.name || 'Untitled' : 'Start something new'}</h3>
          </div>
          <button className="pb-icon-btn" onClick={onClose} aria-label="Close">
            <Icon.X s={20} c="var(--ink-2)" />
          </button>
        </div>

        <div className="pb-modal-body">
          {error && (
            <div style={{ marginBottom: 16 }} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}
          <div className="pb-form-grid">
            <Field label="Project name" full>
              <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Meridian brand refresh" />
            </Field>
            <Field label="Client">
              <input className={inputClass} value={form.client} onChange={(e) => set('client', e.target.value)} placeholder="Client name" />
            </Field>
            <Field label="Status">
              <div className="pb-select-wrap">
                <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as Status)}>
                  <option value="active">Active</option>
                  <option value="on_hold">On hold</option>
                  <option value="completed">Completed</option>
                </select>
                <Icon.ChevronDown s={18} c="var(--ink-3)" />
              </div>
            </Field>
            <Field label="Budget ($)">
              <input className={inputClass} type="number" min={0} value={form.budget} onChange={(e) => set('budget', Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="Spent ($)">
              <input className={inputClass} type="number" min={0} value={form.spent} onChange={(e) => set('spent', Number(e.target.value))} placeholder="0" />
            </Field>
            <Field label="Due date" full>
              <input className={inputClass} type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </Field>
            <Field label={`Progress · ${form.progress}%`} full>
              <input className="pb-range" type="range" min={0} max={100} value={form.progress} onChange={(e) => set('progress', Number(e.target.value))} />
              <ProgressBar value={form.progress} color="var(--amber)" />
            </Field>
          </div>
        </div>

        <div className="pb-modal-foot">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading} disabled={!form.name || !form.client}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </div>
    </div>
  )
}
