import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UpcomingPayment } from '@/hooks/useFinanceData';

interface PaymentTimelineProps {
  payments: UpcomingPayment[];
}

export function PaymentTimeline({ payments }: PaymentTimelineProps) {
  const next14Days = payments.filter(p => p.status === 'pending' && p.daysUntil >= 0 && p.daysUntil <= 14);

  if (next14Days.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Nenhum pagamento nos próximos 14 dias 🎉
      </div>
    );
  }

  // Group by day
  const grouped = next14Days.reduce((acc, p) => {
    const key = p.daysUntil;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<number, UpcomingPayment[]>);

  const dayLabel = (days: number) => {
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Amanhã';
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  const urgencyDot = (urgency: string) => {
    if (urgency === 'overdue' || urgency === 'urgent') return 'bg-destructive';
    if (urgency === 'warning') return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([days, items]) => (
          <div key={days} className="flex-shrink-0 min-w-[140px]">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">{dayLabel(Number(days))}</p>
            <div className="space-y-1.5">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 py-1">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', urgencyDot(item.urgency))} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
