import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, RefreshCw, MoreHorizontal, Eye, RotateCcw,
  CheckCircle2, XCircle, Clock, Loader2, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fetchJobs, fetchJob, reprocessJob, type Job, type JobDetail, type JobStatus } from '@/api/jobs';
import { formatDate } from '@/constants';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: { label: string; value: JobStatus | 'all' }[] = [
  { label: 'All',        value: 'all' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Pending',    value: 'pending' },
  { label: 'Failed',     value: 'failed' },
];

// ─── Job Detail Modal ─────────────────────────────────────────────────────────

function JobDetailModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJob(jobId)
      .then(setJob)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [jobId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-sm font-bold text-navy-800">Job Detail</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-sm text-danger-600">{error}</p>}
          {job && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Rows',    value: job.totalRows.toLocaleString(),     color: 'text-navy-800' },
                  { label: 'Valid',         value: job.validRows.toLocaleString(),      color: 'text-success-600' },
                  { label: 'Invalid',       value: job.invalidRows.toLocaleString(),    color: 'text-danger-600' },
                  { label: 'Duplicates',    value: job.duplicateRows.toLocaleString(), color: 'text-warning-600' },
                  { label: 'Duration',      value: job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : '—', color: 'text-navy-600' },
                  { label: 'Status',        value: job.status,                         color: 'text-navy-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-surface-50 rounded-lg p-3">
                    <p className="text-2xs text-navy-500 uppercase tracking-wide">{label}</p>
                    <p className={cn('text-sm font-bold mt-0.5', color)}>{value}</p>
                  </div>
                ))}
              </div>

              {job.errorMessage && (
                <div className="bg-danger-50 border border-danger-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-danger-700 mb-1">Error</p>
                  <p className="text-xs text-danger-600">{job.errorMessage}</p>
                </div>
              )}

              {/* Invalid row samples */}
              {job.invalidRowSamples.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-navy-700 mb-2">
                    Invalid Rows (showing up to {job.invalidRowSamples.length})
                  </p>
                  <div className="space-y-2">
                    {job.invalidRowSamples.map((row) => (
                      <div key={row.id} className="bg-danger-50 border border-danger-100 rounded-md px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-navy-700">{row.employeeCode} — {row.employeeName}</span>
                          <span className="text-2xs text-navy-500">{row.department}</span>
                        </div>
                        <p className="text-2xs text-danger-600">{row.errorMessage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Jobs Page ───────────────────────────────────────────────────────────

export default function JobsPage() {
  const [activeFilter, setActiveFilter] = useState<JobStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reprocessingIds, setReprocessingIds] = useState<Set<string>>(new Set());

  const loadJobs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await fetchJobs();
      setJobs(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadJobs(); }, [loadJobs]);

  // Auto-poll when any job is in pending/processing state
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'processing');
    if (!hasActive) return;
    const interval = setInterval(() => void loadJobs(true), 3000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  const handleReprocess = async (jobId: string) => {
    setReprocessingIds((prev) => new Set(prev).add(jobId));
    try {
      await reprocessJob(jobId);
      await loadJobs(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reprocess failed');
    } finally {
      setReprocessingIds((prev) => { const s = new Set(prev); s.delete(jobId); return s; });
    }
  };

  const filtered = jobs.filter((j) => {
    const matchStatus = activeFilter === 'all' || j.status === activeFilter;
    const matchSearch = j.filename.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    pending: jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Processing Jobs"
        subtitle="Monitor timesheet upload jobs and their validation results."
        action={
          <button
            onClick={() => void loadJobs()}
            disabled={refreshing}
            className="btn-secondary text-xs"
          >
            {refreshing
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            Refresh
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs',    value: counts.total,     color: 'text-navy-800' },
          { label: 'Completed',    value: counts.completed, color: 'text-success-600' },
          { label: 'Failed',       value: counts.failed,    color: 'text-danger-600' },
          { label: 'In Progress',  value: counts.pending,   color: 'text-warning-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-navy-500">{label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-navy-500 mr-1" />
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                activeFilter === value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-navy-600 border-surface-200 hover:border-primary-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-300" />
          <input
            id="jobs-search"
            type="search"
            placeholder="Search by file name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="table-header px-5 py-3 text-left">File Name</th>
                <th className="table-header px-4 py-3 text-left">Uploaded</th>
                <th className="table-header px-4 py-3 text-right">Total</th>
                <th className="table-header px-4 py-3 text-right">Valid</th>
                <th className="table-header px-4 py-3 text-right">Invalid</th>
                <th className="table-header px-4 py-3 text-right">Dupes</th>
                <th className="table-header px-4 py-3 text-left">Status</th>
                <th className="table-header px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-xs text-navy-400">
                      <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      Loading jobs…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-navy-500">
                    {jobs.length === 0
                      ? 'No jobs yet. Upload a timesheet to get started.'
                      : 'No jobs match your filters.'
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((job) => {
                  const isActive = job.status === 'pending' || job.status === 'processing';
                  return (
                    <tr key={job.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {job.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-success-600 flex-shrink-0" />}
                          {job.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-danger-600 flex-shrink-0" />}
                          {isActive && <Clock className="w-3.5 h-3.5 text-warning-600 flex-shrink-0 animate-pulse" />}
                          <span className="text-xs font-medium text-navy-700 truncate max-w-[160px]">{job.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-navy-500 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-navy-700">{job.totalRows.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-success-600">{job.validRows.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-danger-600">{job.invalidRows}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-navy-500">{job.duplicateRows}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 text-xs text-navy-500">
                        {job.durationMs ? `${(job.durationMs / 1000).toFixed(1)}s` : isActive ? '…' : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedJobId(job.id)}
                            className="p-1 rounded hover:bg-surface-100 text-navy-400 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {(job.status === 'failed' || job.status === 'pending') && (
                            <button
                              onClick={() => void handleReprocess(job.id)}
                              disabled={reprocessingIds.has(job.id)}
                              className="p-1 rounded hover:bg-surface-100 text-navy-400 transition-colors disabled:opacity-50"
                              title="Reprocess"
                            >
                              <RotateCcw className={cn('w-3.5 h-3.5', reprocessingIds.has(job.id) && 'animate-spin')} />
                            </button>
                          )}
                          <button className="p-1 rounded hover:bg-surface-100 text-navy-400 transition-colors">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job detail modal */}
      {selectedJobId && (
        <JobDetailModal jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  );
}
