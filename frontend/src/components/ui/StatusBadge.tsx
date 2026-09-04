import { type JobStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: JobStatus | 'valid' | 'invalid' | 'duplicate';
  className?: string;
}

const STATUS_CONFIG = {
  completed: { label: 'Completed', className: 'badge-completed' },
  processing: { label: 'Processing', className: 'badge-processing' },
  pending:    { label: 'Pending',    className: 'badge-pending' },
  failed:     { label: 'Failed',     className: 'badge-failed' },
  valid:      { label: 'Valid',      className: 'badge-completed' },
  invalid:    { label: 'Invalid',    className: 'badge-failed' },
  duplicate:  { label: 'Duplicate',  className: 'badge-pending' },
} as const;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'badge-pending' };
  return (
    <span className={cn(config.className, className)}>
      {config.label}
    </span>
  );
}
