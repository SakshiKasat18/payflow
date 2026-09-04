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
        <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-navy-500" />
          <h2 className="text-sm font-semibold text-navy-800">Organization</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="org-name" className="label">Organization Name</label>
            <input
              id="org-name"
              type="text"
              defaultValue={user?.organizationName ?? ''}
              className="input max-w-sm"
            />
          </div>
          <div>
            <label htmlFor="org-timezone" className="label">Timezone</label>
            <select id="org-timezone" className="input max-w-sm" defaultValue="Asia/Kolkata">
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>
          <div>
            <label htmlFor="overtime-threshold" className="label">Daily Overtime Threshold (hours)</label>
            <input id="overtime-threshold" type="number" defaultValue={8} min={1} max={24} className="input max-w-[120px]" />
            <p className="text-xs text-navy-500 mt-1">Hours per day above which overtime applies. Default: 8 hours.</p>
          </div>
          <div>
            <label htmlFor="weekly-overtime-threshold" className="label">Weekly Overtime Threshold (hours)</label>
            <input id="weekly-overtime-threshold" type="number" defaultValue={40} min={1} max={168} className="input max-w-[120px]" />
            <p className="text-xs text-navy-500 mt-1">Hours per week above which overtime applies. Default: 40 hours.</p>
          </div>
          <div>
            <label htmlFor="overtime-multiplier" className="label">Overtime Rate Multiplier</label>
            <input id="overtime-multiplier" type="number" defaultValue={1.5} min={1} step={0.1} className="input max-w-[120px]" />
            <p className="text-xs text-navy-500 mt-1">Multiplier applied to hourly rate for overtime hours. Default: 1.5×.</p>
          </div>
          <button className="btn-primary text-xs">Save Organization Settings</button>
        </div>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
          <User className="w-4 h-4 text-navy-500" />
          <h2 className="text-sm font-semibold text-navy-800">Profile</h2>
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
                defaultValue={user?.name ?? ''}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="label">Email Address</label>
              <input
                id="profile-email"
                type="email"
                defaultValue={user?.email ?? ''}
                className="input"
              />
            </div>
          </div>
          <button className="btn-primary text-xs">Update Profile</button>
        </div>
      </div>

      {/* Security */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-navy-500" />
          <h2 className="text-sm font-semibold text-navy-800">Security</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label htmlFor="current-password" className="label">Current Password</label>
            <input id="current-password" type="password" placeholder="••••••••" className="input max-w-sm" />
          </div>
          <div>
            <label htmlFor="new-password" className="label">New Password</label>
            <input id="new-password" type="password" placeholder="••••••••" className="input max-w-sm" />
          </div>
          <button className="btn-secondary text-xs">Change Password</button>
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
