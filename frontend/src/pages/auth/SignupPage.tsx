import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/constants';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    organizationName: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        name: form.name,
        email: form.email,
        password: form.password,
        organizationName: form.organizationName,
      });
      // AuthContext sets user → ProtectedRoute redirects to dashboard automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.');
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
            <h1 className="text-lg font-bold text-navy-800">Create your account</h1>
            <p className="text-xs text-navy-500 mt-1">Set up your organization on PayFlow.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-100 rounded-md px-3 py-2.5 mb-4">
              <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700">{error}</p>
            </div>
          )}

          <form id="signup-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-name" className="label">Full Name</label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Your full name"
                className="input"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="signup-org" className="label">Organization Name</label>
              <input
                id="signup-org"
                name="organizationName"
                type="text"
                required
                value={form.organizationName}
                onChange={handleChange}
                placeholder="Your company name"
                className="input"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="label">Email address</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className="input"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="label">Password</label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className="input pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  id="toggle-signup-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="label">Confirm Password</label>
              <input
                id="signup-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className={cn('input', form.confirmPassword && form.confirmPassword !== form.password && 'border-danger-400 focus:ring-danger-400')}
                disabled={isLoading}
              />
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-2.5 mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-navy-500">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-2xs text-surface-300 mt-6">
          © 2026 PayFlow · All rights reserved
        </p>
      </div>
    </div>
  );
}
