import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, CloudUpload, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { uploadTimesheet, fetchJobs, type Job } from '@/api/jobs';
import { formatDate } from '@/constants';
import { cn } from '@/lib/utils';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

const REQUIRED_COLUMNS = [
  'employee_id', 'employee_name', 'department',
  'date', 'clock_in', 'clock_out', 'hourly_rate',
];

const VALIDATION_RULES = [
  { ok: true,  text: 'clock_out must be after clock_in' },
  { ok: true,  text: 'Dates must not be in the future' },
  { ok: true,  text: 'Hourly rate must be positive' },
  { ok: true,  text: 'All required fields must be present' },
  { ok: false, text: 'Duplicate rows (same employee + date + clock_in) are flagged' },
  { ok: false, text: 'Overlapping shifts for the same employee/day are flagged' },
];

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadResult, setUploadResult] = useState<{ jobId: string; totalRows: number; filename: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Load recent jobs on mount (and after upload)
  const loadRecentJobs = useCallback(async () => {
    try {
      const jobs = await fetchJobs();
      setRecentJobs(jobs.slice(0, 5));
    } catch {
      // non-critical — table just stays empty
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { void loadRecentJobs(); }, [loadRecentJobs]);

  // Poll for job status update after upload
  useEffect(() => {
    if (!uploadResult) return;
    const interval = setInterval(() => { void loadRecentJobs(); }, 3000);
    return () => clearInterval(interval);
  }, [uploadResult, loadRecentJobs]);

  const handleFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json')) {
      setErrorMessage('Only .csv and .json files are supported.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File exceeds the 50 MB limit.');
      return;
    }
    setErrorMessage('');
    setSelectedFile(file);
    setUploadState('idle');
    setUploadResult(null);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleUpload = async () => {
    if (!selectedFile || uploadState === 'uploading') return;
    setUploadState('uploading');
    setErrorMessage('');
    try {
      const result = await uploadTimesheet(selectedFile);
      setUploadResult(result);
      setUploadState('success');
      setSelectedFile(null);
      void loadRecentJobs();
    } catch (err) {
      setUploadState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setUploadResult(null);
    setErrorMessage('');
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <PageHeader
        title="Upload Timesheets"
        subtitle="Upload a CSV or JSON file containing employee clock-in/clock-out records."
      />

      {/* Upload Card */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-navy-800 mb-4">Upload File</h2>

        {/* Success state */}
        {uploadState === 'success' && uploadResult && (
          <div className="mb-4 flex items-start gap-3 bg-success-50 border border-success-100 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-success-800">Upload successful!</p>
              <p className="text-xs text-success-700 mt-0.5">
                <span className="font-medium">{uploadResult.filename}</span> — {uploadResult.totalRows.toLocaleString()} rows queued for processing. The table below updates automatically.
              </p>
              <p className="text-2xs text-success-600 mt-1">Job ID: {uploadResult.jobId}</p>
            </div>
            <button onClick={reset} className="text-success-400 hover:text-success-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div className="mb-4 flex items-start gap-3 bg-danger-50 border border-danger-100 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-danger-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger-700">{errorMessage}</p>
          </div>
        )}

        {/* Dropzone */}
        <div
          id="upload-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg px-8 py-12 flex flex-col items-center gap-3 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-primary-400 bg-primary-50'
              : selectedFile
                ? 'border-success-300 bg-success-50'
                : 'border-surface-200 hover:border-primary-300 hover:bg-surface-50',
          )}
          onClick={() => !selectedFile && document.getElementById('file-input')?.click()}
        >
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
            isDragging ? 'bg-primary-100' : selectedFile ? 'bg-success-100' : 'bg-surface-100',
          )}>
            <CloudUpload className={cn('w-7 h-7', isDragging ? 'text-primary-600' : selectedFile ? 'text-success-600' : 'text-surface-300')} />
          </div>

          {selectedFile ? (
            <div>
              <p className="text-sm font-semibold text-navy-800">{selectedFile.name}</p>
              <p className="text-xs text-navy-500 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB · Ready to upload</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-navy-700">Drag & drop your timesheet file here</p>
              <p className="text-xs text-navy-500 mt-0.5">or <span className="text-primary-600 font-medium">click to browse</span></p>
            </div>
          )}

          <input
            id="file-input"
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Action row */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-navy-500">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-success-600" />
              <span>CSV (.csv)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-600" />
              <span>JSON (.json)</span>
            </div>
            <span className="text-surface-300">Max 50 MB</span>
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2">
              <button onClick={reset} className="btn-secondary text-xs py-1.5">
                Clear
              </button>
              <button
                id="upload-submit"
                onClick={handleUpload}
                disabled={uploadState === 'uploading'}
                className="btn-primary text-xs py-1.5"
              >
                {uploadState === 'uploading' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload & Process
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Required Columns */}
        <div className="mt-6 pt-5 border-t border-surface-100">
          <p className="text-xs font-semibold text-navy-700 mb-3">Required Columns</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {REQUIRED_COLUMNS.map((col) => (
              <div key={col} className="bg-surface-50 border border-surface-200 rounded px-2.5 py-1.5">
                <code className="text-xs text-primary-700 font-mono">{col}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Validation Rules */}
        <div className="mt-4 pt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VALIDATION_RULES.map(({ ok, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-navy-600">
              {ok
                ? <CheckCircle2 className="w-3.5 h-3.5 text-success-600 flex-shrink-0" />
                : <AlertCircle className="w-3.5 h-3.5 text-warning-600 flex-shrink-0" />
              }
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="card">
        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-800">Recent Uploads</h2>
          <button onClick={loadRecentJobs} className="text-xs text-navy-500 hover:text-primary-600 transition-colors">
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="table-header px-5 py-3 text-left">File Name</th>
                <th className="table-header px-4 py-3 text-left">Uploaded</th>
                <th className="table-header px-4 py-3 text-right">Rows</th>
                <th className="table-header px-4 py-3 text-right">Valid</th>
                <th className="table-header px-4 py-3 text-right">Invalid</th>
                <th className="table-header px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loadingJobs ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-navy-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-navy-400">
                    No uploads yet. Upload your first timesheet above.
                  </td>
                </tr>
              ) : (
                recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Upload className="w-3.5 h-3.5 text-navy-400" />
                        <span className="text-xs font-medium text-navy-700">{job.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-navy-500 whitespace-nowrap">{formatDate(job.createdAt)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-navy-700">{job.totalRows.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-success-600">{job.validRows.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-danger-600">{job.invalidRows}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
