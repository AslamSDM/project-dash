import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { Avatar } from './ui'
import { Icon } from './icons'

const NAV = [
  { to: '/app', label: 'Dashboard', end: true, icon: Icon.Grid },
  { to: '/app/projects', label: 'Projects', icon: Icon.Folder },
  { to: '/app/time', label: 'Time', icon: Icon.Clock },
  { to: '/app/profile', label: 'Profile', icon: Icon.User },
]

function Wordmark({ light }: { light?: boolean }) {
  return (
    <div className="pb-wordmark">
      <span className="pb-logomark" style={{ background: light ? 'var(--paper)' : 'var(--amber)' }}>
        <Icon.Pulse s={20} c={light ? 'var(--amber)' : 'var(--paper)'} />
      </span>
      <span className="pb-wordmark-text" style={{ color: light ? 'var(--paper)' : 'var(--ink)' }}>
        Pulse<span style={{ color: 'var(--amber)' }}>Board</span>
      </span>
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const title =
    location.pathname === '/app'
      ? user?.name ?? 'Dashboard'
      : location.pathname.endsWith('/projects')
        ? 'Projects'
        : location.pathname.endsWith('/time')
          ? 'Time tracking'
          : location.pathname.endsWith('/profile')
            ? 'Your profile'
            : (user?.name ?? '')

  return (
    <div className="pb-app">
      <div className={'pb-scrim' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <aside className={'pb-sidebar grain' + (open ? ' open' : '')}>
        <div className="pb-sidebar-top">
          <Wordmark light />
        </div>
        <nav className="pb-nav">
          {NAV.map(({ to, label, end, icon: IconEl }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => 'pb-nav-item' + (isActive ? ' on' : '')}>
              {({ isActive }) => (
                <>
                  <IconEl s={20} c={isActive ? 'var(--paper)' : 'rgba(245,245,250,0.62)'} />
                  <span>{label}</span>
                  {isActive && <span className="pb-nav-rail" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="pb-sidebar-foot">
          <div className="pb-upgrade">
            <p className="pb-upgrade-title">Studio plan</p>
            <p className="pb-upgrade-sub">8 of 10 active projects</p>
            <div className="pb-upgrade-bar">
              <span style={{ width: '80%' }} />
            </div>
          </div>
          <button className="pb-nav-item pb-signout" onClick={handleLogout}>
            <Icon.Logout s={20} c="rgba(245,245,250,0.62)" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="pb-main">
        <header className="pb-topbar">
          <button className="pb-hamburger" onClick={() => setOpen(true)} aria-label="Menu">
            <Icon.Menu s={22} c="var(--ink)" />
          </button>
          <div className="pb-topbar-title">
            <p className="pb-topbar-eyebrow">Welcome back</p>
            <h1 className="pb-topbar-h1">{title}</h1>
          </div>
          <div className="pb-topbar-actions">
            <button className="pb-icon-btn" aria-label="Notifications">
              <Icon.Bell s={20} c="var(--ink-2)" />
              <span className="pb-badge-dot" />
            </button>
            <div className="pb-topbar-user">
              <Avatar initials={user ? initials(user.name) : ''} size={38} color={user?.avatarColor} />
              <div className="pb-topbar-user-meta">
                <span className="pb-topbar-user-name">{user?.name}</span>
                <span className="pb-topbar-user-role">{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="pb-content grain">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
