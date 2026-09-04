import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, children, className }: ChartCardProps) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
          {subtitle && <p className="text-xs text-navy-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="text-xs text-navy-500">{action}</div>}
      </div>
      {children}
    </div>
  );
}
