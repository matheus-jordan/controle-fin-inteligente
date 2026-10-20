import { Badge } from '@/components/ui/badge';
import { Priority, priorityConfig } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <Badge variant="outline" className={cn(config.bgClass, config.textClass, 'border-0 font-medium text-xs', className)}>
      {config.label}
    </Badge>
  );
}
