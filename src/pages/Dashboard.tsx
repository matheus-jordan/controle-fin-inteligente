import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFinanceSummary, useUpcomingPayments, useUpdateTransaction } from '@/hooks/useFinanceData';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { PaymentTimeline } from '@/components/dashboard/PaymentTimeline';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, PiggyBank, Check, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Dashboard() {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentMonth = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const summary = useFinanceSummary(currentMonth);
  const { payments, isLoading } = useUpcomingPayments(currentMonth);
  const updateTransaction = useUpdateTransaction();

  const overdueCount = payments.filter(p => p.status === 'pending' && p.urgency === 'overdue').length;
  const pendingPayments = payments.filter(p => p.status === 'pending');

  const handleMarkPaid = async (payment: typeof payments[0]) => {
    if (payment.source !== 'transaction') return;
    try {
      await updateTransaction.mutateAsync({ id: payment.id, status: 'paid' });
      toast.success(`${payment.name} marcado como pago!`);
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const urgencyBorder = (urgency: string) => {
    if (urgency === 'overdue' || urgency === 'urgent') return 'border-l-destructive';
    if (urgency === 'warning') return 'border-l-warning';
    if (urgency === 'none') return 'border-l-muted-foreground';
    return 'border-l-success';
  };

  const urgencyLabel = (daysUntil: number | null) => {
    if (daysUntil === null) return 'Sem vencimento';
    if (daysUntil < 0) return `${Math.abs(daysUntil)}d atrás`;
    if (daysUntil === 0) return 'Hoje';
    if (daysUntil === 1) return 'Amanhã';
    return `em ${daysUntil}d`;
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Month Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(o => o - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold capitalize">{monthLabel}</h2>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(o => o + 1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Alert Banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Você tem {overdueCount} conta(s) vencida(s)!</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-2 sm:p-3 text-center">
              <TrendingUp className="h-4 w-4 text-success mx-auto mb-0.5" />
              <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Entradas</p>
              <p className="text-xs sm:text-sm font-bold font-mono money-positive truncate">{formatCurrency(summary.income)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-3 text-center">
              <TrendingDown className="h-4 w-4 text-destructive mx-auto mb-0.5" />
              <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Saídas</p>
              <p className="text-xs sm:text-sm font-bold font-mono money-negative truncate">{formatCurrency(summary.expenses)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2 sm:p-3 text-center">
              <PiggyBank className="h-4 w-4 text-primary mx-auto mb-0.5" />
              <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">Restante</p>
              <p className={cn('text-xs sm:text-sm font-bold font-mono truncate', summary.estimatedRemaining >= 0 ? 'money-positive' : 'money-negative')}>
                {formatCurrency(summary.estimatedRemaining)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Timeline */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">📅 Linha do Tempo</h3>
            <PaymentTimeline payments={payments} />
          </CardContent>
        </Card>

        {/* Bills to Pay */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">
              Contas a Pagar
              {pendingPayments.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({pendingPayments.length} pendente{pendingPayments.length > 1 ? 's' : ''})
                </span>
              )}
            </h3>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
            ) : pendingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Tudo em dia! 🎉</p>
            ) : (
              <div className="space-y-2">
                {pendingPayments.map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      'flex items-center justify-between py-2.5 pl-3 pr-2 border-l-2 rounded-r-md bg-card hover:bg-accent/50 transition-colors',
                      urgencyBorder(p.urgency)
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <PriorityBadge priority={p.priority} />
                      </div>
                      <p className={cn(
                        'text-[10px] font-medium mt-0.5',
                        p.urgency === 'overdue' || p.urgency === 'urgent' ? 'text-destructive' :
                        p.urgency === 'warning' ? 'text-warning' :
                        p.urgency === 'none' ? 'text-muted-foreground' : 'text-muted-foreground'
                      )}>
                        {urgencyLabel(p.daysUntil)}
                        {p.source === 'fixed_bill' && ' • Conta fixa'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold font-mono">{formatCurrency(p.amount)}</p>
                      {p.source === 'transaction' && (
                        <button
                          onClick={() => handleMarkPaid(p)}
                          className="p-1.5 rounded-md hover:bg-success/10 transition-colors"
                          title="Marcar como pago"
                        >
                          <Check className="h-4 w-4 text-muted-foreground hover:text-success" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
