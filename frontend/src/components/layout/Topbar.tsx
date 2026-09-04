import { useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface TopbarProps {
  className?: string;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function Topbar({ className }: TopbarProps) {
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');

  const initials = user ? getInitials(user.name) : '?';

  return (
    <header className={cn('h-14 bg-white border-b border-surface-200 flex items-center px-6 gap-4 flex-shrink-0', className)}>
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-300 pointer-events-none" />
        <input
          id="global-search"
          type="search"
          placeholder="Search employees, jobs, or reports…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="input pl-9 py-1.5 text-sm bg-surface-50"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <button
          id="notification-button"
          className="relative w-8 h-8 flex items-center justify-center rounded-md text-navy-600 hover:bg-surface-100 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-surface-200 mx-1" />

        {/* Authenticated user */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary-700">{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-navy-800 leading-tight">
              {user?.name ?? ''}
            </p>
            <p className="text-2xs text-navy-500 leading-tight">
              {user?.organizationName ?? ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
