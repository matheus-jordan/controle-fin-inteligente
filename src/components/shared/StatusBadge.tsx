import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'paid' | 'pending' | 'overdue' | 'active' | 'paid_off';
  className?: string;
}

const statusConfig = {
  paid: { label: 'Pago', className: 'bg-success/10 text-success border-0' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning border-0' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive border-0' },
  active: { label: 'Ativo', className: 'bg-primary/10 text-primary border-0' },
  paid_off: { label: 'Quitado', className: 'bg-success/10 text-success border-0' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn(config.className, 'font-medium text-xs', className)}>
      {config.label}
    </Badge>
  );
}
