import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Filter, ArrowUpDown, ChevronDown, ChevronUp, X, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState, CardSkeleton } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchJobs } from '@/api/jobs';
import { fetchJobPayroll, fetchJobAnalytics, fetchEmployeeDetail, type PayrollRow, type Analytics, type EmployeePayrollDetail } from '@/api/payroll';
import { apiClient } from '@/api/client';
import { formatCurrency, formatDate } from '@/constants';
import { cn } from '@/lib/utils';
import type { Job } from '@/api/jobs';

type SortKey = keyof Pick<PayrollRow, 'employeeCode' | 'employeeName' | 'department' | 'totalHours' | 'regularHours' | 'overtimeHours' | 'grossPay'>;

// ─── Employee detail modal ────────────────────────────────────────────────────
function EmployeeDetailModal({ jobId, employeeCode, onClose }: { jobId: string; employeeCode: string; onClose: () => void }) {
  const [detail, setDetail] = useState<EmployeePayrollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEmployeeDetail(jobId, employeeCode)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [jobId, employeeCode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-sm font-bold text-navy-800">Employee Payroll Detail</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading && <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>}
          {error && <p className="text-sm text-danger-600">{error}</p>}
          {detail && (
            <div className="space-y-5">
              {/* Summary */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary-700">{detail.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy-800">{detail.employeeName}</p>
                    <p className="text-xs text-navy-500">{detail.employeeCode} · {detail.department}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Hours', value: `${detail.totalHours}h`, color: 'text-navy-800' },
                    { label: 'Regular Hrs', value: `${detail.regularHours}h`, color: 'text-navy-700' },
                    { label: 'Overtime Hrs', value: `${detail.overtimeHours}h`, color: 'text-amber-700' },
                    { label: 'Hourly Rate', value: `${formatCurrency(detail.hourlyRate)}/hr`, color: 'text-navy-600' },
                    { label: 'Gross Pay', value: formatCurrency(detail.grossPay), color: 'text-navy-800' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-surface-50 rounded-lg p-3">
                      <p className="text-2xs text-navy-500 uppercase tracking-wide">{label}</p>
                      <p className={cn('text-sm font-bold mt-0.5', color)}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Day-by-day rows */}
              <div>
                <p className="text-xs font-semibold text-navy-700 mb-2">Day-by-day Breakdown</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200">
                        {['Date', 'In', 'Out', 'Hours', 'Regular', 'Overtime', 'Gross Pay'].map((h) => (
                          <th key={h} className="table-header px-3 py-2 text-right first:text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {detail.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-surface-50">
                          <td className="px-3 py-2 font-medium text-navy-700">{r.date}</td>
                          <td className="px-3 py-2 text-right text-navy-500">{r.clockIn}</td>
                          <td className="px-3 py-2 text-right text-navy-500">{r.clockOut}</td>
                          <td className="px-3 py-2 text-right text-navy-700">{r.hoursWorked}h</td>
                          <td className="px-3 py-2 text-right text-navy-700">{r.regularHours}h</td>
                          <td className="px-3 py-2 text-right text-amber-700 font-medium">{r.overtimeHours}h</td>
                          <td className="px-3 py-2 text-right font-semibold text-navy-800">{formatCurrency(r.grossPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main PayrollPage ─────────────────────────────────────────────────────────
export default function PayrollPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('grossPay');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const j = await fetchJobs();
      const completed = j.filter((x) => x.status === 'completed');
      setJobs(completed);
      if (completed.length > 0 && !selectedJobId) {
        setSelectedJobId(completed[0]!.id);
      }
    } finally { setLoading(false); }
  }, [selectedJobId]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!selectedJobId) return;
    setRowsLoading(true);
    Promise.all([fetchJobPayroll(selectedJobId), fetchJobAnalytics(selectedJobId)])
      .then(([r, a]) => { setRows(r); setAnalytics(a); })
      .catch(() => { setRows([]); setAnalytics(null); })
      .finally(() => setRowsLoading(false));
  }, [selectedJobId]);

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

  const departments = ['all', ...Array.from(new Set(rows.map((r) => r.department))).sort()];

  const filtered = rows.filter((r) => {
    const matchDept = deptFilter === 'all' || r.department === deptFilter;
    const matchSearch = r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey]; const valB = b[sortKey];
    const diff = typeof valA === 'string' ? valA.localeCompare(valB as string) : (valA as number) - (valB as number);
    return sortDir === 'asc' ? diff : -diff;
  });

  const totalPayroll = sorted.reduce((s, r) => s + r.grossPay, 0);
  const totalOT = sorted.reduce((s, r) => s + r.overtimeHours, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary-600" /> : <ChevronDown className="w-3 h-3 text-primary-600" />;
  };

  const COLS: { label: string; key: SortKey; align: 'left' | 'right' }[] = [
    { label: 'Employee ID', key: 'employeeCode', align: 'left' },
    { label: 'Name', key: 'employeeName', align: 'left' },
    { label: 'Department', key: 'department', align: 'left' },
    { label: 'Regular Hrs', key: 'regularHours', align: 'right' },
    { label: 'Overtime Hrs', key: 'overtimeHours', align: 'right' },
    { label: 'Total Hrs', key: 'totalHours', align: 'right' },
    { label: 'Gross Pay', key: 'grossPay', align: 'right' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Payroll"
        subtitle="Employee payroll breakdown — sortable and searchable."
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : jobs.length === 0 ? (
        <div className="card"><EmptyState icon={<DollarSign className="w-6 h-6" />} title="No completed jobs" description="Upload and process a timesheet to view payroll data." /></div>
      ) : (
        <>
          {/* Job selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-navy-600">Job:</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="input py-1.5 text-xs w-64"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.filename} · {formatDate(j.createdAt)}</option>
              ))}
            </select>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Payroll', value: formatCurrency(totalPayroll) },
              { label: 'Employees', value: `${sorted.length}` },
              { label: 'Avg Gross Pay', value: formatCurrency(sorted.length > 0 ? totalPayroll / sorted.length : 0) },
              { label: 'Total Overtime', value: `${totalOT.toFixed(1)}h` },
            ].map(({ label, value }) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-navy-500">{label}</p>
                <p className="text-lg font-bold text-navy-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-300" />
              <input id="payroll-search" type="search" placeholder="Search employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 py-1.5 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-navy-500" />
              <select id="department-filter" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input py-1.5 text-xs w-44">
                {departments.map((d) => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {rowsLoading ? <LoadingState rows={6} cols={7} className="p-5" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200">
                      {COLS.map(({ label, key, align }) => (
                        <th key={key} className={`table-header px-4 py-3 text-${align}`}>
                          <button onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-navy-800 transition-colors">
                            {label} <SortIcon col={key} />
                          </button>
                        </th>
                      ))}
                      <th className="table-header px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {sorted.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-navy-400">No records match your filters.</td></tr>
                    ) : sorted.map((emp) => (
                      <tr key={emp.employeeCode} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-navy-500">{emp.employeeCode}</td>
                        <td className="px-4 py-3 text-xs font-medium text-navy-800">{emp.employeeName}</td>
                        <td className="px-4 py-3 text-xs text-navy-600">{emp.department}</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-700">{emp.regularHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-amber-700 font-medium">{emp.overtimeHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-700">{emp.totalHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(emp.grossPay)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedEmployee(emp.employeeCode)} className="text-xs text-primary-600 hover:text-primary-700">
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-50 border-t border-surface-200">
                      <td colSpan={6} className="px-4 py-3 text-xs font-semibold text-navy-700 text-right">Total</td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-navy-800">{formatCurrency(totalPayroll)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Department breakdown from analytics */}
          {analytics && analytics.departmentMetrics.length > 0 && (
            <div className="card">
              <div className="px-5 py-4 border-b border-surface-100">
                <h2 className="text-sm font-semibold text-navy-800">Payroll by Department</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-100">
                      <th className="table-header px-5 py-3 text-left">Department</th>
                      <th className="table-header px-4 py-3 text-right">Employees</th>
                      <th className="table-header px-4 py-3 text-right">Regular Hrs</th>
                      <th className="table-header px-4 py-3 text-right">Overtime Hrs</th>
                      <th className="table-header px-4 py-3 text-right">OT %</th>
                      <th className="table-header px-4 py-3 text-right">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {analytics.departmentMetrics.map((dept) => (
                      <tr key={dept.department} className="hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-3 text-xs font-medium text-navy-800">{dept.department}</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.employeeCount}</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.regularHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-amber-700">{dept.overtimeHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-500">{dept.overtimePct.toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(dept.totalPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee detail modal */}
      {selectedEmployee && selectedJobId && (
        <EmployeeDetailModal
          jobId={selectedJobId}
          employeeCode={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}
