import { House, Map, Ticket, User, type LucideIcon } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'
import { cx } from '../../design-system'
import { useSession } from '../session'
import './AppShell.css'

const tabs: { to: string; label: string; icon: LucideIcon; match: (pathname: string) => boolean }[] = [
  {
    to: '/',
    label: 'Home',
    icon: House,
    match: (pathname) => pathname === '/' || pathname.startsWith('/events/'),
  },
  { to: '/map', label: 'Map', icon: Map, match: (pathname) => pathname === '/map' },
  { to: '/tickets', label: 'Tickets', icon: Ticket, match: (pathname) => pathname === '/tickets' },
  { to: '/profile', label: 'Profile', icon: User, match: (pathname) => pathname === '/profile' || pathname.startsWith('/profile/') },
]

export function AppShell() {
  const session = useSession()

  return (
    <div className="shell">
      <div className="shell__stage">
        <Outlet />
      </div>
      {session.location && <TabBar />}
    </div>
  )
}

/** Home stays current on an open event, which a single NavLink path cannot express. */
function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav className="tab-bar" aria-label="Primary">
      {tabs.map(({ to, label, icon: Icon, match }) => {
        const current = match(pathname)
        return (
          <Link
            key={to}
            to={to}
            className={cx('tab-bar__link', current && 'is-active')}
            aria-current={current ? 'page' : undefined}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
