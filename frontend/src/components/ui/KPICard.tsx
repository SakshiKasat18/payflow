import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  note?: string;
  className?: string;
}

export function KPICard({
  title,
  value,
  change,
  changeLabel = 'from last period',
  icon,
  iconBg = 'bg-primary-50',
  iconColor = 'text-primary-600',
  note,
  className,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral  = change === undefined || change === 0;

  return (
    <div className={cn('card p-5 flex items-start gap-4 animate-fade-in', className)}>
      <div className={cn('p-2.5 rounded-lg flex-shrink-0', iconBg)}>
        <span className={cn('block w-5 h-5', iconColor)}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-navy-600 font-medium truncate">{title}</p>
        <p className="text-2xl font-bold text-navy-800 mt-0.5 leading-tight">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            {isPositive && <TrendingUp className="w-3.5 h-3.5 text-success-600 flex-shrink-0" />}
            {isNegative && <TrendingDown className="w-3.5 h-3.5 text-danger-600 flex-shrink-0" />}
            {isNeutral  && <Minus className="w-3.5 h-3.5 text-surface-300 flex-shrink-0" />}
            <span className={cn(
              'text-xs font-medium',
              isPositive && 'text-success-600',
              isNegative && 'text-danger-600',
              isNeutral  && 'text-surface-300',
            )}>
              {isPositive ? '+' : ''}{change}% {changeLabel}
            </span>
          </div>
        )}
        {note && !change && (
          <p className="text-xs text-navy-500 mt-1.5">{note}</p>
        )}
      </div>
    </div>
  );
}
