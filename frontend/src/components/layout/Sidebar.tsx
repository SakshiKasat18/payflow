import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Cpu,
  DollarSign,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to: string;
}

const WORKSPACE_NAV: NavItem[] = [
  { label: 'Dashboard',         icon: <LayoutDashboard className="w-4 h-4" />, to: ROUTES.DASHBOARD },
  { label: 'Upload Timesheets', icon: <Upload className="w-4 h-4" />,          to: ROUTES.UPLOAD },
  { label: 'Processing Jobs',   icon: <Cpu className="w-4 h-4" />,             to: ROUTES.JOBS },
  { label: 'Payroll',           icon: <DollarSign className="w-4 h-4" />,      to: ROUTES.PAYROLL },
  { label: 'Employees',         icon: <Users className="w-4 h-4" />,           to: ROUTES.EMPLOYEES },
  { label: 'Departments',       icon: <Building2 className="w-4 h-4" />,       to: ROUTES.DEPARTMENTS },
  { label: 'Reports',           icon: <BarChart3 className="w-4 h-4" />,       to: ROUTES.REPORTS },
];

const SYSTEM_NAV: NavItem[] = [
  { label: 'Settings', icon: <Settings className="w-4 h-4" />, to: ROUTES.SETTINGS },
];

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
          isActive
            ? 'bg-primary-50 text-primary-700 font-semibold'
            : 'text-navy-600 hover:bg-surface-100 hover:text-navy-800',
        )
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );
}

/** Returns up to 2 uppercase initials from a display name */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const initials = user ? getInitials(user.name) : '?';
  const displayName = user?.name ?? 'Loading…';
  const orgName = user?.organizationName ?? '';

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-surface-200 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-surface-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <p className="font-bold text-navy-800 text-sm leading-tight">PayFlow</p>
            <p className="text-2xs text-navy-500 leading-tight">Workforce. Simplified.</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        <div>
          <p className="section-label">Workspace</p>
          <ul className="space-y-0.5">
            {WORKSPACE_NAV.map((item) => (
              <li key={item.to}><NavItemLink item={item} /></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="section-label">System</p>
          <ul className="space-y-0.5">
            {SYSTEM_NAV.map((item) => (
              <li key={item.to}><NavItemLink item={item} /></li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Authenticated user at bottom */}
      <div className="px-2 py-4 border-t border-surface-200 space-y-0.5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary-700">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy-800 truncate">{displayName}</p>
            <p className="text-2xs text-navy-500 truncate">{orgName}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-navy-600 rounded-md hover:bg-surface-100 hover:text-navy-800 transition-colors duration-150"
          id="logout-button"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
