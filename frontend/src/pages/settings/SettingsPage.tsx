import { Building2, User, Shield, Sliders } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export default function SettingsPage() {
  const { user } = useAuth();
  const initials = user ? getInitials(user.name) : '?';

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <PageHeader
        title="Settings"
        subtitle="Manage your organization settings, profile, and preferences."
      />

      {/* Organization Settings */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-navy-500" />
            <h2 className="text-sm font-semibold text-navy-800">Organization Settings</h2>
          </div>
          <span className="badge-info text-2xs">Standard Rules</span>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="org-name" className="label">Organization Name</label>
            <input
              id="org-name"
              type="text"
              readOnly
              value={user?.organizationName ?? ''}
              className="input max-w-sm bg-surface-50 cursor-not-allowed text-navy-600"
            />
          </div>
          <div>
            <label htmlFor="org-timezone" className="label">Timezone</label>
            <select id="org-timezone" disabled className="input max-w-sm bg-surface-50 cursor-not-allowed text-navy-600" defaultValue="Asia/Kolkata">
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>
          <div className="pt-2 border-t border-surface-100">
            <p className="text-xs font-medium text-navy-700 mb-3">Payroll & Overtime Parameters (System Defaults)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="overtime-threshold" className="label">Daily Overtime</label>
                <input id="overtime-threshold" type="number" readOnly value={8} className="input max-w-[120px] bg-surface-50 cursor-not-allowed" />
                <p className="text-2xs text-navy-400 mt-1">8h/day standard threshold</p>
              </div>
              <div>
                <label htmlFor="weekly-overtime-threshold" className="label">Weekly Regular Cap</label>
                <input id="weekly-overtime-threshold" type="number" readOnly value={40} className="input max-w-[120px] bg-surface-50 cursor-not-allowed" />
                <p className="text-2xs text-navy-400 mt-1">40h/week standard cap</p>
              </div>
              <div>
                <label htmlFor="overtime-multiplier" className="label">OT Rate Multiplier</label>
                <input id="overtime-multiplier" type="number" readOnly value={1.5} className="input max-w-[120px] bg-surface-50 cursor-not-allowed" />
                <p className="text-2xs text-navy-400 mt-1">1.5× hourly pay rate</p>
              </div>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs text-navy-400">
            <span>Standard payroll calculation rules are actively enforced.</span>
            <span className="text-2xs bg-surface-100 text-navy-500 px-2 py-1 rounded">Rule Customization: Roadmap</span>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-navy-500" />
            <h2 className="text-sm font-semibold text-navy-800">Profile</h2>
          </div>
          <span className="badge-neutral text-2xs">Active Account</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-base font-bold text-primary-700">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-800">{user?.name ?? '—'}</p>
              <p className="text-xs text-navy-500">{user?.email ?? '—'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-name" className="label">Full Name</label>
              <input
                id="profile-name"
                type="text"
                readOnly
                value={user?.name ?? ''}
                className="input bg-surface-50 cursor-not-allowed text-navy-600"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="label">Email Address</label>
              <input
                id="profile-email"
                type="email"
                readOnly
                value={user?.email ?? ''}
                className="input bg-surface-50 cursor-not-allowed text-navy-600"
              />
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-xs text-navy-400">
            <span>Profile details are managed via tenant authentication.</span>
            <span className="text-2xs bg-surface-100 text-navy-500 px-2 py-1 rounded">Profile Editing: Roadmap</span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-navy-500" />
            <h2 className="text-sm font-semibold text-navy-800">Security</h2>
          </div>
          <span className="badge-success text-2xs">JWT Protected</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-navy-600">
            Authentication is secured via salted bcrypt password hashing and tenant-scoped JSON Web Tokens (JWT).
          </p>
          <div className="flex items-center justify-between pt-2 text-xs text-navy-400">
            <span>Session is valid and isolated to your organization.</span>
            <span className="text-2xs bg-surface-100 text-navy-500 px-2 py-1 rounded">Password Reset: Roadmap</span>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-navy-500" />
          <h2 className="text-sm font-semibold text-navy-800">Preferences</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            { id: 'notif-upload', label: 'Email notifications on upload completion' },
            { id: 'notif-error', label: 'Alert me on processing failures' },
            { id: 'notif-weekly', label: 'Weekly payroll summary digest' },
          ].map(({ id, label }) => (
            <label key={id} className="flex items-center gap-3 cursor-pointer group">
              <input
                id={id}
                type="checkbox"
                defaultChecked
                className="w-4 h-4 rounded border-surface-200 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-navy-700 group-hover:text-navy-800">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
