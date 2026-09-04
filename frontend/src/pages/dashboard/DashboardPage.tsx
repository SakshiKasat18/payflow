import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  DollarSign,
  Clock,
  Zap,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Calendar,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts';
import { Link } from 'react-router-dom';
import { KPICard } from '@/components/ui/KPICard';
import { ChartCard } from '@/components/ui/ChartCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  fetchDashboardAnalytics,
  fetchMyDashboard,
  type DashboardAnalytics,
  type EmployeeSelfPayroll,
} from '@/api/payroll';
import { formatCurrency, formatHours, formatDate, ROUTES } from '@/constants';

const CHART_BLUE  = '#2563eb';
const CHART_BLUE_LIGHT = '#bfdbfe';
const CHART_AMBER = '#d97706';
const PIE_COLORS = [CHART_BLUE, CHART_AMBER];

function CurrencyTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-200 shadow-card-md rounded-md px-3 py-2">
      <p className="text-xs text-navy-600 mb-1">{label}</p>
      <p className="text-sm font-semibold text-navy-800">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  );
}

// ─── Employee Portal Dashboard ────────────────────────────────────────────────
function EmployeeDashboard() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const [data, setData] = useState<EmployeeSelfPayroll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    else setRefreshing(true);
    try {
      const d = await fetchMyDashboard();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employee dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isEmpty = !loading && !error && data && data.totalHours === 0 && data.payslips.length === 0;
  const regularHours = data?.regularHours ?? 0;
  const overtimeHours = data?.overtimeHours ?? 0;
  const totalHours = data?.totalHours ?? 0;
  const overtimePct = totalHours > 0 ? Math.round((overtimeHours / totalHours) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-info text-2xs uppercase tracking-wide font-semibold">Employee Portal</span>
            {data?.department && (
              <span className="text-2xs text-navy-500 font-medium">
                {data.department} · {data.employeeCode ?? 'EMP'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-navy-800">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-navy-600 mt-0.5">
            Here is your personal payroll summary and recorded shift history.
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 border border-danger-100 rounded-lg p-4 text-sm text-danger-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} className="h-64" />)}
          </div>
        </>
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="card">
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="No personal payroll records found"
            description="Timesheets for your account have not been processed yet. Your personal hours and earnings will appear here once finalized."
          />
        </div>
      )}

      {/* Real Data */}
      {!loading && !error && data && (data.totalHours > 0 || data.grossPay > 0 || data.payslips.length > 0) && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              title="Hourly Rate"
              value={data.hourlyRate > 0 ? `${formatCurrency(data.hourlyRate)}/hr` : '—'}
              icon={<DollarSign className="w-5 h-5" />}
              iconBg="bg-blue-50" iconColor="text-blue-600"
              note={data.department ?? 'Standard Rate'}
            />
            <KPICard
              title="Total Gross Earnings"
              value={formatCurrency(data.grossPay)}
              icon={<DollarSign className="w-5 h-5" />}
              iconBg="bg-emerald-50" iconColor="text-emerald-600"
              note="Processed earnings across shifts"
            />
            <KPICard
              title="Total Hours Worked"
              value={formatHours(totalHours)}
              icon={<Clock className="w-5 h-5" />}
              iconBg="bg-violet-50" iconColor="text-violet-600"
              note={`${formatHours(regularHours)} regular hours`}
            />
            <KPICard
              title="Overtime Hours"
              value={formatHours(overtimeHours)}
              note={overtimeHours > 0 ? `${overtimePct}% of worked hours (1.5× rate)` : 'No overtime recorded'}
              icon={<Zap className="w-5 h-5" />}
              iconBg="bg-amber-50" iconColor="text-amber-600"
            />
          </div>

          {/* Payslips & Recent Shifts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Payslips List */}
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-navy-600" />
                  <span className="text-sm font-semibold text-navy-800">My Payslips & Periods</span>
                </div>
                <Link to={ROUTES.PAYROLL} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 space-y-3">
                {data.payslips.length === 0 ? (
                  <p className="text-xs text-navy-400 text-center py-6">No payslips available</p>
                ) : data.payslips.map((ps) => (
                  <div key={ps.jobId} className="p-3.5 rounded-lg border border-surface-200 hover:border-primary-200 transition-colors bg-surface-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-navy-800">{ps.filename}</p>
                        <p className="text-2xs text-navy-500 mt-0.5">{formatDate(ps.date)} · {ps.shifts.length} shifts</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{formatCurrency(ps.grossPay)}</span>
                    </div>
                    <div className="flex items-center justify-between text-2xs text-navy-600 mt-2.5 pt-2 border-t border-surface-100">
                      <span>Regular: {ps.regularHours.toFixed(1)}h</span>
                      <span className="text-amber-700 font-medium">Overtime: {ps.overtimeHours.toFixed(1)}h</span>
                      <span>Total: {ps.totalHours.toFixed(1)}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shift History Table */}
            <div className="card lg:col-span-3">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-navy-600" />
                  <span className="text-sm font-semibold text-navy-800">Recent Shift Logs</span>
                </div>
                <span className="text-2xs text-navy-400 font-medium">Last {data.recentShifts.length} recorded shifts</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100 bg-surface-50/50">
                      <th className="table-header px-4 py-2.5 text-left">Date</th>
                      <th className="table-header px-3 py-2.5 text-right">Clock In</th>
                      <th className="table-header px-3 py-2.5 text-right">Clock Out</th>
                      <th className="table-header px-3 py-2.5 text-right">Hours</th>
                      <th className="table-header px-3 py-2.5 text-right">OT</th>
                      <th className="table-header px-4 py-2.5 text-right">Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {data.recentShifts.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-navy-400">No shifts logged</td></tr>
                    ) : data.recentShifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-2.5 text-navy-700 font-medium text-xs">{shift.date}</td>
                        <td className="px-3 py-2.5 text-right text-navy-500 text-xs">{shift.clockIn}</td>
                        <td className="px-3 py-2.5 text-right text-navy-500 text-xs">{shift.clockOut}</td>
                        <td className="px-3 py-2.5 text-right text-navy-700 text-xs font-medium">{shift.hoursWorked.toFixed(1)}h</td>
                        <td className="px-3 py-2.5 text-right text-amber-700 text-xs font-medium">
                          {shift.overtimeHours > 0 ? `${shift.overtimeHours.toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-navy-800 text-xs font-semibold">{formatCurrency(shift.grossPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Admin / HR Dashboard ─────────────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    else setRefreshing(true);
    try {
      const d = await fetchDashboardAnalytics();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const isEmpty = !loading && !error && data && data.totalPayroll === 0 && data.recentJobs.length === 0;

  const regularHours = data ? data.totalRegularHours : 0;
  const overtimeHours = data ? data.totalOvertimeHours : 0;
  const totalHours = regularHours + overtimeHours;
  const regularPct = totalHours > 0 ? Math.round((regularHours / totalHours) * 100) : 0;
  const overtimePct = totalHours > 0 ? 100 - regularPct : 0;

  const pieData = [
    { name: 'Regular Hours', value: regularHours },
    { name: 'Overtime Hours', value: overtimeHours },
  ];

  const deptChartData = data?.departmentMetrics.map((d) => ({
    department: d.department,
    totalGrossPay: d.totalPay,
  })) ?? [];

  const weeklyChartData = data?.weeklyTrend.map((w) => ({
    week: w.weekLabel,
    totalPay: w.totalPay,
    regularPay: w.regularPay,
    overtimePay: w.overtimePay,
  })) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm text-navy-600 mt-0.5">
            Here's what's happening with your payroll today.
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 border border-danger-100 rounded-lg p-4 text-sm text-danger-700">{error}</div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} className="h-64" />)}
          </div>
        </>
      )}

      {/* Empty state — no data yet */}
      {isEmpty && (
        <div className="card">
          <EmptyState
            icon={<DollarSign className="w-6 h-6" />}
            title="No payroll data yet"
            description="Upload and process a timesheet to see analytics here."
            action={
              <Link to={ROUTES.UPLOAD} className="btn-primary text-xs">
                Upload Timesheet
              </Link>
            }
          />
        </div>
      )}

      {/* Real data */}
      {!loading && !error && data && data.totalPayroll > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              title="Total Employees"
              value={data.totalEmployees.toString()}
              icon={<Users className="w-5 h-5" />}
              iconBg="bg-blue-50" iconColor="text-blue-600"
              note="Active this period"
            />
            <KPICard
              title="Total Payroll"
              value={formatCurrency(data.totalPayroll)}
              icon={<DollarSign className="w-5 h-5" />}
              iconBg="bg-emerald-50" iconColor="text-emerald-600"
              note="Gross pay, current period"
            />
            <KPICard
              title="Total Hours"
              value={formatHours(totalHours)}
              icon={<Clock className="w-5 h-5" />}
              iconBg="bg-violet-50" iconColor="text-violet-600"
              note={`Avg ${data.averageHoursPerEmployee.toFixed(1)}h / employee`}
            />
            <KPICard
              title="Overtime Hours"
              value={formatHours(overtimeHours)}
              note={`${overtimePct}% of total hours · ${data.overtimeCostPercentage.toFixed(1)}% of payroll cost`}
              icon={<Zap className="w-5 h-5" />}
              iconBg="bg-amber-50" iconColor="text-amber-600"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Department Bar Chart */}
            <ChartCard
              title="Payroll by Department"
              action={
                <Link to={ROUTES.DEPARTMENTS} className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
                  View Details <ChevronRight className="w-3 h-3" />
                </Link>
              }
              className="lg:col-span-1"
            >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={deptChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="totalGrossPay" fill={CHART_BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Donut Chart */}
            <ChartCard title="Regular vs. Overtime Hours" className="lg:col-span-1">
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-[180px] h-[170px] flex items-center justify-center">
                  <ResponsiveContainer width={180} height={170}>
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={78}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <p className="text-base font-bold text-navy-800 tracking-tight leading-tight">{formatHours(totalHours)}</p>
                    <p className="text-2xs text-navy-500 font-medium">Total Hours</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-surface-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-600 flex-shrink-0" />
                    <span className="text-navy-600 font-medium">Regular Hours</span>
                  </div>
                  <span className="font-semibold text-navy-800">{formatHours(regularHours)} ({regularPct}%)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-navy-600 font-medium">Overtime Hours</span>
                  </div>
                  <span className="font-semibold text-navy-800">{formatHours(overtimeHours)} ({overtimePct}%)</span>
                </div>
              </div>
            </ChartCard>

            {/* Weekly Trend */}
            <ChartCard title="Weekly Payroll Trend" action={`Last ${weeklyChartData.length} weeks`} className="lg:col-span-1">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weeklyChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Line type="monotone" dataKey="totalPay" stroke={CHART_BLUE} strokeWidth={2} dot={{ fill: CHART_BLUE, r: 3, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Recent Jobs */}
            <div className="card lg:col-span-3">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <span className="text-sm font-semibold text-navy-800">Recent Processing Jobs</span>
                <Link to={ROUTES.JOBS} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="table-header px-5 py-3 text-left">File Name</th>
                      <th className="table-header px-4 py-3 text-left">Uploaded</th>
                      <th className="table-header px-4 py-3 text-right">Total</th>
                      <th className="table-header px-4 py-3 text-right">Valid</th>
                      <th className="table-header px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {data.recentJobs.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-navy-400">No jobs yet</td></tr>
                    ) : data.recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-3 text-navy-700 font-medium text-xs truncate max-w-[140px]">{job.filename}</td>
                        <td className="px-4 py-3 text-navy-500 text-xs whitespace-nowrap">{formatDate(job.createdAt)}</td>
                        <td className="px-4 py-3 text-right text-navy-700 text-xs font-medium">{job.totalRows.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-success-600 text-xs font-medium">{job.validRows.toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={job.status as 'pending' | 'processing' | 'completed' | 'failed'} /></td>
                        <td className="px-4 py-3">
                          <button className="p-1 rounded hover:bg-surface-100 text-navy-400 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Overtime */}
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <span className="text-sm font-semibold text-navy-800">Top 5 by Overtime</span>
                <Link to={ROUTES.EMPLOYEES} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5">
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="table-header px-5 py-3 text-left">#</th>
                      <th className="table-header px-4 py-3 text-left">Employee</th>
                      <th className="table-header px-4 py-3 text-left hidden md:table-cell">Dept</th>
                      <th className="table-header px-4 py-3 text-right">OT Hrs</th>
                      <th className="table-header px-4 py-3 text-right">Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {data.topOvertimeEmployees.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-navy-400">No overtime data</td></tr>
                    ) : data.topOvertimeEmployees.map((emp, i) => (
                      <tr key={emp.employeeCode} className="hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-3 text-navy-500 text-xs font-medium">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold flex-shrink-0" style={{ backgroundColor: CHART_BLUE_LIGHT, color: CHART_BLUE }}>
                              {emp.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-xs font-medium text-navy-700 truncate">{emp.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-navy-500 hidden md:table-cell">{emp.department}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-amber-700">{emp.totalOvertimeHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-navy-700">{formatCurrency(emp.totalPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isEmployee = user?.role?.toUpperCase() === 'EMPLOYEE';

  if (isEmployee) {
    return <EmployeeDashboard />;
  }

  return <AdminDashboard />;
}
