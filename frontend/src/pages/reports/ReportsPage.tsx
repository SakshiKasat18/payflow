import { useState, useEffect, useCallback } from 'react';
import { Download, BarChart3, TrendingUp, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { ChartCard } from '@/components/ui/ChartCard';
import { fetchJobs, type Job } from '@/api/jobs';
import { fetchJobAnalytics, regenerateAnalytics, type Analytics } from '@/api/payroll';
import { apiClient } from '@/api/client';
import { formatCurrency, formatDate } from '@/constants';

export default function ReportsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const j = await fetchJobs();
      const completed = j.filter((x) => x.status === 'completed');
      setJobs(completed);
      if (completed.length > 0) setSelectedJobId(completed[0]!.id);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!selectedJobId) return;
    setAnalyticsLoading(true);
    fetchJobAnalytics(selectedJobId)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [selectedJobId]);

  const handleRegenerate = async () => {
    if (!selectedJobId) return;
    setRegenerating(true);
    try {
      const a = await regenerateAnalytics(selectedJobId);
      setAnalytics(a);
    } finally { setRegenerating(false); }
  };

  const handleExport = async () => {
    if (!selectedJobId || exporting) return;
    setExporting(true);
    try {
      const resp = await apiClient.get<Blob>(`/jobs/${selectedJobId}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      const job = jobs.find((j) => j.id === selectedJobId);
      a.download = `payroll_${job?.filename ?? selectedJobId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const deptChartData = analytics?.departmentMetrics.map((d) => ({
    department: d.department,
    totalGrossPay: d.totalPay,
    overtimePay: d.overtimePay,
    regularPay: d.regularPay,
  })) ?? [];

  const weeklyChartData = analytics?.weeklyTrend.map((w) => ({
    week: w.weekLabel,
    totalPay: w.totalPay,
    regularPay: w.regularPay,
    overtimePay: w.overtimePay,
  })) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate payroll reports and analytics for your organization."
        action={
          selectedJobId ? (
            <button onClick={() => void handleExport()} disabled={exporting} className="btn-secondary text-xs">
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No analytics yet" description="Upload and process a timesheet to generate reports." />
        </div>
      ) : (
        <>
          {/* Job selector + regen */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-medium text-navy-600">Job:</label>
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="input py-1.5 text-xs w-64">
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.filename} · {formatDate(j.createdAt)}</option>)}
            </select>
            <button onClick={() => void handleRegenerate()} disabled={regenerating} className="btn-secondary text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              Recalculate
            </button>
          </div>

          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : !analytics ? (
            <div className="card"><EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No analytics for this job" description="Click 'Recalculate' to generate analytics for this job." /></div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Payroll', value: formatCurrency(analytics.totalPayroll), icon: <BarChart3 className="w-4 h-4 text-primary-600" />, bg: 'bg-primary-50' },
                  { label: 'Regular Hrs', value: `${analytics.totalRegularHours.toFixed(1)}h`, icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50' },
                  { label: 'Overtime Hrs', value: `${analytics.totalOvertimeHours.toFixed(1)}h`, icon: <AlertTriangle className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50' },
                  { label: 'Avg Hrs/Emp', value: `${analytics.averageHoursPerEmployee.toFixed(1)}h`, icon: <Users className="w-4 h-4 text-violet-600" />, bg: 'bg-violet-50' },
                  { label: 'OT Cost %', value: `${analytics.overtimeCostPercentage.toFixed(1)}%`, icon: <AlertTriangle className="w-4 h-4 text-orange-600" />, bg: 'bg-orange-50' },
                  { label: 'Std Dev (Hrs)', value: `${analytics.stdDeviationHours.toFixed(2)}`, icon: <BarChart3 className="w-4 h-4 text-navy-500" />, bg: 'bg-surface-100' },
                ].map(({ label, value, icon, bg }) => (
                  <div key={label} className="card p-4">
                    <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center mb-2`}>{icon}</div>
                    <p className="text-2xs text-navy-500">{label}</p>
                    <p className="text-sm font-bold text-navy-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Payroll by Department" subtitle="Gross pay breakdown">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={deptChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v), 'Gross Pay']} contentStyle={{ fontSize: 12, borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="totalGrossPay" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Weekly Payroll Trend" subtitle="Regular vs. overtime pay">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={weeklyChartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => [formatCurrency(v)]} contentStyle={{ fontSize: 12, borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="regularPay" stroke="#2563eb" strokeWidth={2} dot={false} name="Regular Pay" />
                      <Line type="monotone" dataKey="overtimePay" stroke="#d97706" strokeWidth={2} dot={false} name="Overtime Pay" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Top overtime employees */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-navy-800">Top 5 Overtime Employees</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="table-header px-5 py-3 text-left">#</th>
                        <th className="table-header px-4 py-3 text-left">Employee</th>
                        <th className="table-header px-4 py-3 text-left">Department</th>
                        <th className="table-header px-4 py-3 text-right">Total Hrs</th>
                        <th className="table-header px-4 py-3 text-right">Overtime Hrs</th>
                        <th className="table-header px-4 py-3 text-right">OT Pay</th>
                        <th className="table-header px-4 py-3 text-right">Gross Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {analytics.topOvertimeEmployees.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-navy-400">No overtime recorded</td></tr>
                      ) : analytics.topOvertimeEmployees.map((emp, i) => (
                        <tr key={emp.employeeCode} className="hover:bg-surface-50 transition-colors">
                          <td className="px-5 py-3 text-xs font-medium text-navy-500">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-xs font-medium text-navy-800">{emp.employeeName}</p>
                              <p className="text-2xs text-navy-400 font-mono">{emp.employeeCode}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-navy-600">{emp.department}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-700">{emp.totalHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs font-medium text-amber-700">{emp.totalOvertimeHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{formatCurrency(emp.overtimePay)}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(emp.totalPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Department breakdown */}
              <div className="card">
                <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-600" />
                  <h2 className="text-sm font-semibold text-navy-800">Department Payroll</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="table-header px-5 py-3 text-left">Department</th>
                        <th className="table-header px-4 py-3 text-right">Employees</th>
                        <th className="table-header px-4 py-3 text-right">Regular Hrs</th>
                        <th className="table-header px-4 py-3 text-right">Overtime Hrs</th>
                        <th className="table-header px-4 py-3 text-right">Regular Pay</th>
                        <th className="table-header px-4 py-3 text-right">Overtime Pay</th>
                        <th className="table-header px-4 py-3 text-right">Total Pay</th>
                        <th className="table-header px-4 py-3 text-right">OT %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {analytics.departmentMetrics.map((dept) => (
                        <tr key={dept.department} className="hover:bg-surface-50 transition-colors">
                          <td className="px-5 py-3 text-xs font-medium text-navy-800">{dept.department}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.employeeCount}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.regularHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-amber-700">{dept.overtimeHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{formatCurrency(dept.regularPay)}</td>
                          <td className="px-4 py-3 text-right text-xs text-amber-700">{formatCurrency(dept.overtimePay)}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(dept.totalPay)}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-500">{dept.overtimePct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Generation timestamp */}
              <p className="text-2xs text-navy-400 text-center">Analytics generated at {new Date(analytics.generatedAt).toLocaleString('en-IN')}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
