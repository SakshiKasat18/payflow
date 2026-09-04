import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ROUTES } from '@/constants';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const LoginPage       = lazy(() => import('@/pages/auth/LoginPage'));
const SignupPage      = lazy(() => import('@/pages/auth/SignupPage'));
const DashboardPage   = lazy(() => import('@/pages/dashboard/DashboardPage'));
const UploadPage      = lazy(() => import('@/pages/timesheets/UploadPage'));
const JobsPage        = lazy(() => import('@/pages/jobs/JobsPage'));
const PayrollPage     = lazy(() => import('@/pages/payroll/PayrollPage'));
const EmployeesPage   = lazy(() => import('@/pages/employees/EmployeesPage'));
const DepartmentsPage = lazy(() => import('@/pages/departments/DepartmentsPage'));
const ReportsPage     = lazy(() => import('@/pages/reports/ReportsPage'));
const SettingsPage    = lazy(() => import('@/pages/settings/SettingsPage'));

// ─── Full-page spinner ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50">
      <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

// ─── Session restore guard: wait while checking localStorage token ────────────
function SessionLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface-50 gap-3">
      <div className="w-7 h-7 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      <p className="text-xs text-navy-500">Restoring session…</p>
    </div>
  );
}

// ─── Protected route: redirect to /login if not authenticated ─────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SessionLoader />;
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </DashboardLayout>
  );
}

// ─── Public-only route: redirect to /dashboard if already logged in ───────────
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <SessionLoader />;
  if (isAuthenticated) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// ─── Router ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

      {/* Auth pages — redirect to dashboard if already logged in */}
      <Route path={ROUTES.LOGIN}  element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path={ROUTES.SIGNUP} element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />

      {/* Protected dashboard routes */}
      <Route path={ROUTES.DASHBOARD}   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path={ROUTES.UPLOAD}      element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
      <Route path={ROUTES.JOBS}        element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
      <Route path={ROUTES.PAYROLL}     element={<ProtectedRoute><PayrollPage /></ProtectedRoute>} />
      <Route path={ROUTES.EMPLOYEES}   element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENTS} element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} />
      <Route path={ROUTES.REPORTS}     element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SETTINGS}    element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* 404 → dashboard (will redirect to login if not authed) */}
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
