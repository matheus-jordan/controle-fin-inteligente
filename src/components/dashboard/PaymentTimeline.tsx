import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UpcomingPayment } from '@/hooks/useFinanceData';

interface PaymentTimelineProps {
  payments: UpcomingPayment[];
}

export function PaymentTimeline({ payments }: PaymentTimelineProps) {
  // Only show pending payments that have a due date
  const withDueDate = payments.filter(p => p.status === 'pending' && p.dueDate !== null);

  if (withDueDate.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Nenhum pagamento com vencimento definido 🎉
      </div>
    );
  }

  // Group by due date
  const grouped = withDueDate.reduce((acc, p) => {
    const key = p.dueDate!.toISOString().split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, UpcomingPayment[]>);

  const urgencyDot = (urgency: string) => {
    if (urgency === 'overdue' || urgency === 'urgent') return 'bg-destructive';
    if (urgency === 'warning') return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, items]) => {
          const date = new Date(dateKey + 'T00:00:00');
          const label = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
          const today = new Date();
          const isToday = date.toDateString() === today.toDateString();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const isTomorrow = date.toDateString() === tomorrow.toDateString();

          return (
            <div key={dateKey} className="flex-shrink-0 min-w-[140px]">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                {isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : label}
              </p>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', urgencyDot(item.urgency))} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{formatCurrency(item.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
