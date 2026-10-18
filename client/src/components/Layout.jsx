import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardCheck, TriangleAlert, PenLine, GraduationCap, Users, Library, Clapperboard, Megaphone,
  CalendarClock, CalendarDays, Settings2, Inbox, Wallet, Package, FileSpreadsheet, UserCog, ScrollText,
  Menu, X, ChevronDown, LogOut, Globe, UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const GROUPS = ['Overview', 'Academics', 'Learning', 'School', 'Finance and stores', 'Administration'];

export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', roles: '*', end: true },
  { to: '/attendance', label: 'Take attendance', icon: ClipboardCheck, group: 'Academics', roles: ['trainer', 'dos', 'headteacher'] },
  { to: '/monitoring', label: 'Absence monitoring', icon: TriangleAlert, group: 'Academics', roles: ['trainer', 'dos', 'headteacher'] },
  { to: '/my-attendance', label: 'Attendance', icon: ClipboardCheck, group: 'Academics', roles: ['student', 'parent'] },
  { to: '/marks', label: 'Marks entry', icon: PenLine, group: 'Academics', roles: ['trainer', 'dos'] },
  { to: '/results', label: 'Results', icon: GraduationCap, group: 'Academics', roles: ['student', 'parent', 'dos', 'headteacher', 'trainer'] },
  { to: '/students', label: 'Students', icon: Users, group: 'Academics', roles: ['dos', 'headteacher', 'trainer'] },
  { to: '/resources', label: 'Learning materials', icon: Library, group: 'Learning', roles: ['student', 'trainer', 'dos', 'headteacher'] },
  { to: '/entertainment', label: 'Edutainment', icon: Clapperboard, group: 'Learning', roles: ['student', 'trainer', 'dos', 'headteacher'] },
  { to: '/announcements', label: 'Announcements', icon: Megaphone, group: 'School', roles: '*' },
  { to: '/timetable', label: 'Timetable', icon: CalendarClock, group: 'School', roles: '*' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, group: 'School', roles: '*' },
  { to: '/academic', label: 'Academic setup', icon: Settings2, group: 'School', roles: ['dos', 'headteacher'] },
  { to: '/inquiries', label: 'Website inquiries', icon: Inbox, group: 'School', roles: ['headteacher', 'dos'] },
  { to: '/finance', label: 'Fees and finance', icon: Wallet, group: 'Finance and stores', roles: ['accountant', 'headteacher', 'parent', 'student'] },
  { to: '/inventory', label: 'Inventory', icon: Package, group: 'Finance and stores', roles: ['librarian', 'headteacher', 'dos'] },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet, group: 'Finance and stores', roles: ['dos', 'headteacher', 'accountant'] },
  { to: '/users', label: 'Users and roles', icon: UserCog, group: 'Administration', roles: ['headteacher'] },
  { to: '/audit', label: 'Audit logs', icon: ScrollText, group: 'Administration', roles: ['headteacher'] },
];

export const ROLE_LABEL = {
  admin: 'System Administrator', headteacher: 'Head Teacher', dos: 'Director of Studies', trainer: 'Trainer',
  student: 'Student', parent: 'Parent / Guardian', accountant: 'Accountant', librarian: 'Librarian / Storekeeper',
};

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Sidebar({ items, onNavigate }) {
  const groups = GROUPS.map((g) => ({ name: g, items: items.filter((n) => n.group === g) })).filter((g) => g.items.length);
  return (
    <nav className="flex h-full flex-col bg-ink-900 text-white" aria-label="Portal">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 border-b border-white/10 px-5 py-4" title="Back to the school website">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white p-1"><img src="/logo.png" alt="" className="h-full w-full object-contain" /></span>
        <span className="font-serif leading-tight"><span className="block text-[15px] font-semibold">Groupe Scolaire</span><span className="block text-[15px] font-semibold text-brand-200">APACOPE</span></span>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.name}>
            {g.name !== 'Overview' && <p className="mb-1.5 px-3 text-xs font-medium text-white/45">{g.name}</p>}
            <ul className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={onNavigate}
                    className={({ isActive }) => `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-brand-500" aria-hidden="true" />}
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 hover:bg-ink-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">{initials(user.name)}</span>
        <span className="hidden text-left leading-tight sm:block"><span className="block text-sm font-semibold">{user.name}</span><span className="block text-xs text-ink-500">{ROLE_LABEL[user.role]}</span></span>
        <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
          <div className="border-b border-ink-100 px-3 py-2 sm:hidden"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-ink-500">{ROLE_LABEL[user.role]}</p></div>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); navigate('/account'); }}><UserRound className="h-4 w-4" />My account</button>
          <Link role="menuitem" className={item} to="/" onClick={() => setOpen(false)}><Globe className="h-4 w-4" />School website</Link>
          <button role="menuitem" className={`${item} border-t border-ink-100 text-brand-700`} onClick={() => { logout(); navigate('/login'); }}><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  const items = NAV.filter((n) => n.roles === '*' || user.role === 'admin' || n.roles.includes(user.role));
  const current = NAV.find((n) => n.to === pathname);
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [pathname]);
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block"><Sidebar items={items} /></aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl"><Sidebar items={items} onNavigate={() => setDrawer(false)} /></div>
          <button className="absolute left-[19rem] top-3 rounded-full bg-white p-1.5 shadow" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button className="rounded p-1.5 hover:bg-ink-100 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <p className="truncate text-sm text-ink-500">
            {current ? <><span className="hidden sm:inline">{current.group} / </span><span className="font-medium text-ink-900">{current.label}</span></> : <span className="font-medium text-ink-900">My account</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-ink-500 md:block">{date}</span>
          <UserMenu />
        </div>
      </header>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl"><Outlet /></div>
      </main>
    </div>
  );
}
