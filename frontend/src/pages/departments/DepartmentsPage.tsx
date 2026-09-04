import { useState, useEffect, useCallback } from 'react';
import { Building2, Users, DollarSign, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchJobs, type Job } from '@/api/jobs';
import { fetchJobAnalytics, type Analytics, type DepartmentMetric } from '@/api/payroll';
import { formatCurrency, formatDate } from '@/constants';

function DeptCard({ dept }: { dept: DepartmentMetric }) {
  const overtimePct = dept.overtimePct;
  return (
    <div className="card p-5 hover:shadow-card-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy-800">{dept.department}</h3>
          <p className="text-2xs text-navy-500">{dept.employeeCount} employees</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xs text-navy-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Gross Pay</p>
          <p className="text-sm font-bold text-navy-800 mt-0.5">{formatCurrency(dept.totalPay)}</p>
        </div>
        <div>
          <p className="text-2xs text-navy-500 flex items-center gap-1"><Users className="w-3 h-3" /> Headcount</p>
          <p className="text-sm font-bold text-navy-800 mt-0.5">{dept.employeeCount}</p>
        </div>
        <div>
          <p className="text-2xs text-navy-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Regular Hrs</p>
          <p className="text-sm font-semibold text-navy-700 mt-0.5">{dept.regularHours.toFixed(1)}h</p>
        </div>
        <div>
          <p className="text-2xs text-navy-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Overtime</p>
          <p className="text-sm font-semibold text-amber-700 mt-0.5">{dept.overtimeHours.toFixed(1)}h</p>
        </div>
      </div>

      {/* Overtime bar */}
      <div className="mt-4">
        <div className="flex justify-between text-2xs text-navy-500 mb-1">
          <span>Overtime rate</span>
          <span>{overtimePct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(overtimePct, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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

  const depts = analytics?.departmentMetrics ?? [];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Departments" subtitle="Payroll and headcount overview by department." />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} className="h-48" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="No department data yet" description="Upload and process a timesheet to view department analytics." />
        </div>
      ) : (
        <>
          {/* Job selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-navy-600">Job:</label>
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="input py-1.5 text-xs w-64">
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.filename} · {formatDate(j.createdAt)}</option>)}
            </select>
          </div>

          {analyticsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} className="h-48" />)}
            </div>
          ) : depts.length === 0 ? (
            <div className="card"><EmptyState icon={<Building2 className="w-6 h-6" />} title="No department data" description="No valid payroll rows found in this job." /></div>
          ) : (
            <>
              {/* Department Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {depts.map((dept) => <DeptCard key={dept.department} dept={dept} />)}
              </div>

              {/* Department Summary Table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-100">
                  <h2 className="text-sm font-semibold text-navy-800">Department Summary</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200">
                        <th className="table-header px-5 py-3 text-left">Department</th>
                        <th className="table-header px-4 py-3 text-right">Employees</th>
                        <th className="table-header px-4 py-3 text-right">Total Hrs</th>
                        <th className="table-header px-4 py-3 text-right">Regular Hrs</th>
                        <th className="table-header px-4 py-3 text-right">Overtime Hrs</th>
                        <th className="table-header px-4 py-3 text-right">OT %</th>
                        <th className="table-header px-4 py-3 text-right">Total Pay</th>
                        <th className="table-header px-4 py-3 text-right">Avg Pay/Employee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {depts.map((dept) => (
                        <tr key={dept.department} className="hover:bg-surface-50 transition-colors">
                          <td className="px-5 py-3 text-xs font-medium text-navy-800">{dept.department}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.employeeCount}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.totalHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">{dept.regularHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-amber-700 font-medium">{dept.overtimeHours.toFixed(1)}h</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-500">{dept.overtimePct.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-navy-800">{formatCurrency(dept.totalPay)}</td>
                          <td className="px-4 py-3 text-right text-xs text-navy-600">
                            {formatCurrency(dept.employeeCount > 0 ? dept.totalPay / dept.employeeCount : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
