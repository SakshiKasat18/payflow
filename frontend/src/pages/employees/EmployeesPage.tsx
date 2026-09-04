import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, UserCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchJobs, type Job } from '@/api/jobs';
import { fetchJobPayroll, type PayrollRow } from '@/api/payroll';
import { formatCurrency, formatDate } from '@/constants';

export default function EmployeesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

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
    setRowsLoading(true);
    fetchJobPayroll(selectedJobId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setRowsLoading(false));
  }, [selectedJobId]);

  const departments = ['all', ...Array.from(new Set(rows.map((r) => r.department))).sort()];

  const filtered = rows.filter((r) => {
    const matchDept = deptFilter === 'all' || r.department === deptFilter;
    const matchSearch =
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeCode.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Employees"
        subtitle="View employee records and payroll details by processed job."
      />

      {loading ? (
        <LoadingState rows={5} cols={5} />
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UserCircle className="w-6 h-6" />}
            title="No employee data yet"
            description="Upload and process a timesheet to populate employee records."
          />
        </div>
      ) : (
        <>
          {/* Job selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-navy-600">Job:</label>
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="input py-1.5 text-xs w-64">
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.filename} · {formatDate(j.createdAt)}</option>
              ))}
            </select>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-300" />
              <input
                id="employee-search"
                type="search"
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-navy-500" />
              <select id="employee-dept-filter" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input py-1.5 text-xs w-44">
                {departments.map((d) => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
              </select>
            </div>
            <p className="text-xs text-navy-500 self-center">{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          {/* Employee Table */}
          <div className="card overflow-hidden">
            {rowsLoading ? <LoadingState rows={6} cols={6} className="p-5" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 border-b border-surface-200">
                      <th className="table-header px-5 py-3 text-left">Employee</th>
                      <th className="table-header px-4 py-3 text-left">ID</th>
                      <th className="table-header px-4 py-3 text-left">Department</th>
                      <th className="table-header px-4 py-3 text-right">Regular Hrs</th>
                      <th className="table-header px-4 py-3 text-right">Overtime Hrs</th>
                      <th className="table-header px-4 py-3 text-right">Total Hrs</th>
                      <th className="table-header px-4 py-3 text-right">Rate/hr</th>
                      <th className="table-header px-4 py-3 text-right">Gross Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {filtered.map((emp) => (
                      <tr key={emp.employeeCode} className="hover:bg-surface-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-primary-700">
                                {emp.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-navy-800">{emp.employeeName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-navy-500">{emp.employeeCode}</td>
                        <td className="px-4 py-3 text-xs text-navy-600">{emp.department}</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-700">{emp.regularHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-amber-700 font-medium">{emp.overtimeHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-700">{emp.totalHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-right text-xs text-navy-500">{formatCurrency(emp.hourlyRate)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(emp.grossPay)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center">
                          <UserCircle className="w-8 h-8 text-surface-200 mx-auto mb-2" />
                          <p className="text-sm text-navy-500">No employees found.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
