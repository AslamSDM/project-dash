import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../lib/api'
import { initials } from '../lib/format'
import { Avatar, Button, Card, Field, inputClass } from '../components/ui'
import { Icon } from '../components/icons'

export default function Profile() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  if (!user) return null

  const handle = user.email.split('@')[0]
  const joined = new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const mismatch = !!pw.next && !!pw.conf && pw.next !== pw.conf
  const setPwField = (k: keyof typeof pw, v: string) => setPw((f) => ({ ...f, [k]: v }))

  const saveAccount = async () => {
    setMsg(null)
    setSavingName(true)
    try {
      const updated = await api.updateProfile(name)
      setUser(updated)
      setMsg({ type: 'ok', text: 'Profile updated.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Update failed' })
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async () => {
    setMsg(null)
    if (mismatch) return
    setSavingPw(true)
    try {
      const updated = await api.updateProfile(name, pw.cur, pw.next)
      setUser(updated)
      setPw({ cur: '', next: '', conf: '' })
      setMsg({ type: 'ok', text: 'Password updated.' })
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof ApiError ? err.message : 'Update failed' })
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="pb-page pb-profile">
      {msg && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ring-1 ${
            msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="pb-profile-grid">
        <Card className="pb-panel pb-profile-card">
          <div className="pb-profile-avatar-wrap">
            <Avatar initials={initials(user.name)} size={92} color={user.avatarColor} />
            <button className="pb-avatar-edit">
              <Icon.Pencil s={15} c="var(--paper)" />
            </button>
          </div>
          <h3 className="pb-profile-name">{user.name}</h3>
          <p className="pb-profile-role">{user.role}</p>
          <div className="pb-profile-meta">
            <div className="pb-pm-row">
              <span>Handle</span>
              <span className="pb-mono">@{handle}</span>
            </div>
            <div className="pb-pm-row">
              <span>Email</span>
              <span>{user.email}</span>
            </div>
            <div className="pb-pm-row">
              <span>Member since</span>
              <span>{joined}</span>
            </div>
          </div>
        </Card>

        <div className="pb-profile-right">
          <Card className="pb-panel">
            <p className="pb-panel-eyebrow">Account</p>
            <h3 className="pb-panel-title">Settings</h3>
            <div className="pb-form-grid pb-settings-grid">
              <Field label="Full name">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Display handle">
                <input className={inputClass} value={`@${handle}`} disabled />
              </Field>
              <Field label="Email">
                <input className={inputClass} value={user.email} disabled />
              </Field>
              <Field label="Role">
                <input className={inputClass} value={user.role} disabled />
              </Field>
            </div>
            <div className="pb-form-actions">
              <Button onClick={saveAccount} loading={savingName} disabled={!name.trim()}>
                Save changes
              </Button>
            </div>
          </Card>

          <Card className="pb-panel">
            <p className="pb-panel-eyebrow">Security</p>
            <h3 className="pb-panel-title">Change password</h3>
            <div className="pb-form-grid pb-settings-grid">
              <Field label="Current password" full>
                <input className={inputClass} type="password" value={pw.cur} onChange={(e) => setPwField('cur', e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <Field label="New password">
                <input className={inputClass} type="password" value={pw.next} onChange={(e) => setPwField('next', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password" hint={mismatch ? "Passwords don't match" : undefined}>
                <input className={inputClass + (mismatch ? ' err' : '')} type="password" value={pw.conf} onChange={(e) => setPwField('conf', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              </Field>
            </div>
            <div className="pb-form-actions">
              <Button variant="secondary" onClick={savePassword} loading={savingPw} disabled={!pw.cur || !pw.next || mismatch}>
                Update password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
