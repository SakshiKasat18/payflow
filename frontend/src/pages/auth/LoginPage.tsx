import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login({ email, password });
      // AuthContext sets user → ProtectedRoute redirects to dashboard automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-base">P</span>
          </div>
          <div>
            <p className="font-bold text-navy-800 leading-tight">PayFlow</p>
            <p className="text-2xs text-navy-500 leading-tight">Workforce. Simplified.</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-7">
          <div className="mb-6">
            <h1 className="text-lg font-bold text-navy-800">Sign in to your account</h1>
            <p className="text-xs text-navy-500 mt-1">Enter your credentials to access PayFlow.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-100 rounded-md px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700">{error}</p>
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="label">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="input"
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="login-password" className="label mb-0">Password</label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className={cn('btn-primary w-full justify-center py-2.5 mt-2')}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-navy-500">
            Don't have an account?{' '}
            <Link to={ROUTES.SIGNUP} className="text-primary-600 hover:text-primary-700 font-medium">
              Create one
            </Link>
          </div>

          {/* Demo shortcuts — development only */}
          <div className="mt-5 pt-5 border-t border-surface-100">
            <p className="text-2xs text-navy-400 text-center mb-2 uppercase tracking-wide font-medium">
              Demo accounts
            </p>
            <div className="flex gap-2">
              {[
                { label: 'Admin / HR', email: 'admin.demo@payflow.local', password: 'Demo@Payflow2026' },
                { label: 'Employee',   email: 'emp.demo@payflow.local',   password: 'Demo@Payflow2026' },
              ].map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => { setEmail(demo.email); setPassword(demo.password); }}
                  className="flex-1 text-2xs text-navy-500 border border-surface-200 rounded-md py-1.5 px-2 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  {demo.label}
                </button>
              ))}
            </div>
            <p className="text-2xs text-surface-300 text-center mt-2">
              Click to pre-fill, then Sign in
            </p>
          </div>
        </div>

        <p className="text-center text-2xs text-surface-300 mt-6">
          © 2026 PayFlow · All rights reserved
        </p>
      </div>
    </div>
  );
}
