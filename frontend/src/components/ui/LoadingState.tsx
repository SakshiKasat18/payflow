import { cn } from '@/lib/utils';

interface LoadingStateProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function LoadingState({ rows = 5, cols = 4, className }: LoadingStateProps) {
  return (
    <div className={cn('space-y-3 p-4', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className={cn(
                'skeleton h-4 rounded',
                j === 0 ? 'w-1/4' : j === cols - 1 ? 'w-1/6' : 'flex-1',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('card p-5 space-y-3', className)}>
      <div className="skeleton h-4 w-1/3 rounded" />
      <div className="skeleton h-8 w-1/2 rounded" />
      <div className="skeleton h-3 w-2/5 rounded" />
    </div>
  );
}
