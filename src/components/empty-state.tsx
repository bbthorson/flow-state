import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Standard empty / zero-data state. Centralizes the centered icon + title +
 * description layout that was reimplemented (with drifting spacing) across the
 * flows drawer, network discovery, and the placeholder panes.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'sm',
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const lg = size === 'lg';
  return (
    <div className={cn('flex flex-col items-center p-10 text-center', className)}>
      <div className={cn('rounded-full bg-muted', lg ? 'mb-4 p-4' : 'mb-3 p-4')}>
        <Icon className={cn('text-muted-foreground', lg ? 'h-8 w-8' : 'h-6 w-6')} />
      </div>
      <div className="space-y-1">
        <p className={cn('font-medium', lg ? 'text-lg' : 'text-sm')}>{title}</p>
        {description && (
          <p className={cn('mx-auto max-w-xs text-muted-foreground', lg ? 'text-sm' : 'text-xs')}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-4">{action}</div>}
    </div>
  );
}
