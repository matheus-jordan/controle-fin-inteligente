import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useFinanceSummary, useUpcomingPayments, useUpdateTransaction, useDebts, usePayCardInvoice, type UpcomingPayment } from '@/hooks/useFinanceData';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { MonthNav } from '@/components/shared/MonthNav';
import { TrendingUp, TrendingDown, Check, AlertTriangle, Landmark, ChevronRight, PartyPopper, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type GroupKey = 'overdue' | 'week' | 'later' | 'none';

const groupLabels: Record<GroupKey, string> = {
  overdue: 'Vencidas',
  week: 'Esta semana',
  later: 'Depois',
  none: 'Sem vencimento',
};

function groupOf(p: UpcomingPayment): GroupKey {
  if (p.daysUntil === null) return 'none';
  if (p.daysUntil < 0) return 'overdue';
  if (p.daysUntil <= 7) return 'week';
  return 'later';
}

export default function Dashboard() {
  const [monthOffset, setMonthOffset] = useState(0);
  const navigate = useNavigate();

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentMonth = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const summary = useFinanceSummary(currentMonth);
  const { payments, isLoading } = useUpcomingPayments(currentMonth);
  const updateTransaction = useUpdateTransaction();
  const payInvoice = usePayCardInvoice();
  const { data: debts } = useDebts();
  const isCurrentMonth = monthOffset === 0;
  // Income use: fixed commitments (recurring, card, debts) plus one-off spending, against income
  const committed = summary.committed;
  const variableSpent = Math.max(0, summary.totalExpenses - committed.total);
  const variableBudget = summary.totalIncome - committed.total;
  const usedPct = summary.totalIncome > 0 ? Math.round((summary.totalExpenses / summary.totalIncome) * 100) : null;
  const usedTone = usedPct === null ? 'text-muted-foreground' : usedPct > 100 ? 'text-destructive' : usedPct > 90 ? 'text-warning' : 'text-success';
  const usageScale = Math.max(summary.totalIncome, summary.totalExpenses, 1);
  const shareOfIncome = (v: number) => (summary.totalIncome > 0 ? `${Math.round((v / summary.totalIncome) * 100)}%` : '');

  const overdueCount = payments.filter(p => p.status === 'pending' && p.urgency === 'overdue').length;
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const groups = (['overdue', 'week', 'later', 'none'] as GroupKey[])
    .map(key => ({ key, items: pendingPayments.filter(p => groupOf(p) === key) }))
    .filter(g => g.items.length > 0);

  // Debts total
  const activeDebts = (debts ?? []).filter(d => d.status === 'active');
  const totalDebtRemaining = activeDebts.reduce((s, d) => s + Number(d.installment_amount) * (d.total_installments - d.paid_installments), 0);

  const paidShare = summary.totalExpenses > 0 ? Math.min(100, (summary.paidExpenses / summary.totalExpenses) * 100) : 0;

  const handleMarkPaid = async (payment: UpcomingPayment) => {
    if (payment.source !== 'transaction' && payment.source !== 'card_invoice') return;
    try {
      if (payment.source === 'card_invoice') await payInvoice.mutateAsync(payment.invoice!);
      else await updateTransaction.mutateAsync({ id: payment.id, status: 'paid' });
      toast.success(`${payment.name} marcado como pago!`);
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const urgencyDot = (urgency: string) => {
    if (urgency === 'overdue' || urgency === 'urgent') return 'bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]';
    if (urgency === 'warning') return 'bg-warning';
    if (urgency === 'none') return 'bg-muted-foreground/50';
    return 'bg-success';
  };

  const urgencyLabel = (p: UpcomingPayment) => {
    if (p.daysUntil === null || !p.dueDate) return 'Sem vencimento';
    const day = p.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    if (p.daysUntil < 0) return `${day} · ${Math.abs(p.daysUntil)}d atrás`;
    if (p.daysUntil === 0) return `${day} · Hoje`;
    if (p.daysUntil === 1) return `${day} · Amanhã`;
    return `${day} · em ${p.daysUntil}d`;
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <MonthNav label={monthLabel} onPrev={() => setMonthOffset(o => o - 1)} onNext={() => setMonthOffset(o => o + 1)} />

        {/* Alert Banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/25 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Você tem {overdueCount} conta{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Saldo Previsto — hero */}
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[hsl(var(--glow)/0.25)] blur-3xl" />
          <CardContent className="p-5 relative">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {isCurrentMonth ? 'Disponível agora' : 'Disponível no mês'}
            </p>
            <p className={cn(
              'text-4xl font-bold font-mono mt-1',
              summary.realizedBalance >= 0 ? 'text-foreground neon-text' : 'money-negative'
            )}>
              {formatCurrency(summary.realizedBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Entradas do mês menos o que já foi pago</p>
            <p className="text-xs text-muted-foreground mt-2">
              Depois de pagar os pendentes ({formatCurrency(summary.pendingExpenses)}), sobram{' '}
              <span className={cn('font-mono font-semibold', summary.estimatedRemaining >= 0 ? 'text-foreground' : 'money-negative')}>
                {formatCurrency(summary.estimatedRemaining)}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-xl bg-success/10 border border-success/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  Entradas ({summary.incomeCount})
                </div>
                <p className="text-base font-semibold font-mono money-positive mt-1">{formatCurrency(summary.totalIncome)}</p>
              </div>
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  Saídas ({summary.expenseCount})
                </div>
                <p className="text-base font-semibold font-mono money-negative mt-1">{formatCurrency(summary.totalExpenses)}</p>
              </div>
            </div>

            {/* Paid vs pending */}
            <div className="mt-5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--glow))] shadow-[0_0_12px_hsl(var(--glow)/0.7)] transition-all"
                  style={{ width: `${paidShare}%` }}
                />
              </div>
              <div className="flex justify-between gap-2 mt-2 text-xs">
                <span className="text-muted-foreground">
                  Pagas ({summary.paidCount}) <span className="font-mono font-semibold text-foreground">{formatCurrency(summary.paidExpenses)}</span>
                </span>
                <span className="text-muted-foreground text-right">
                  Pendentes ({summary.pendingCount}) <span className="font-mono font-semibold text-warning">{formatCurrency(summary.pendingExpenses)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income use */}
        {usedPct !== null && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">Uso da renda</p>
                <p className={cn('text-2xl font-bold font-mono', usedTone)}>{usedPct}%</p>
              </div>
              <div className="relative mt-3">
                <div className="flex h-2 gap-[2px] rounded-full bg-muted overflow-hidden">
                  <div className="bg-[hsl(var(--viz-1))]" style={{ width: `${(committed.total / usageScale) * 100}%` }} title={`Fixos: ${formatCurrency(committed.total)}`} />
                  <div className="bg-[hsl(var(--viz-2))]" style={{ width: `${(variableSpent / usageScale) * 100}%` }} title={`Avulsos: ${formatCurrency(variableSpent)}`} />
                </div>
                {summary.totalExpenses > summary.totalIncome && (
                  // Marks where the income ends when spending goes past it
                  <div className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground" style={{ left: `${(summary.totalIncome / usageScale) * 100}%` }} title="Fim da renda" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div>
                  <p className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-[hsl(var(--viz-1))]" />Fixos {shareOfIncome(committed.total)}</p>
                  <p className="font-mono font-semibold mt-0.5">{formatCurrency(committed.total)}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-[hsl(var(--viz-2))]" />Avulsos {shareOfIncome(variableSpent)}</p>
                  <p className="font-mono font-semibold mt-0.5">{formatCurrency(variableSpent)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {variableBudget <= 0 ? (
                  <>Os fixos sozinhos já passam a renda em <span className="font-mono font-semibold money-negative">{formatCurrency(-variableBudget)}</span>.</>
                ) : variableSpent > variableBudget ? (
                  <>
                    Depois dos fixos sobravam <span className="font-mono font-semibold text-foreground">{formatCurrency(variableBudget)}</span> para avulsos.
                    Você passou <span className="font-mono font-semibold money-negative">{formatCurrency(variableSpent - variableBudget)}</span>.
                  </>
                ) : (
                  <>
                    Depois dos fixos sobram <span className="font-mono font-semibold text-foreground">{formatCurrency(variableBudget)}</span> para avulsos.
                    Ainda restam <span className="font-mono font-semibold money-positive">{formatCurrency(variableBudget - variableSpent)}</span>.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Debts summary */}
        {activeDebts.length > 0 && (
          <button onClick={() => navigate('/debts')} className="w-full text-left">
            <Card className="hover:bg-accent/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <Landmark className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Dívidas ativas ({activeDebts.length}) · restante a pagar</p>
                  <p className="text-base font-semibold font-mono money-negative">{formatCurrency(totalDebtRemaining)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </button>
        )}

        {/* Bills to Pay */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-1">
              Contas a pagar
              {pendingPayments.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {pendingPayments.length} pendente{pendingPayments.length > 1 ? 's' : ''}
                </span>
              )}
            </h3>

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
            ) : pendingPayments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <PartyPopper className="h-6 w-6 text-success" />
                Tudo em dia!
              </div>
            ) : (
              <div className="space-y-4 mt-3">
                {groups.map(g => (
                  <div key={g.key}>
                    <p className={cn(
                      'text-xs font-semibold uppercase tracking-wider mb-1.5',
                      g.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {groupLabels[g.key]}
                    </p>
                    <div className="divide-y divide-border">
                      {g.items.map(p => (
                        <div key={p.id} className="flex items-center gap-3 py-2.5">
                          {p.source === 'card_invoice'
                            ? <CreditCard className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--glow))]" />
                            : <span className={cn('h-2 w-2 rounded-full shrink-0', urgencyDot(p.urgency))} />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              {(p.priority === 'essential' || p.priority === 'critical') && <PriorityBadge priority={p.priority} />}
                            </div>
                            <p className={cn(
                              'text-xs mt-0.5',
                              p.urgency === 'overdue' || p.urgency === 'urgent' ? 'text-destructive' :
                              p.urgency === 'warning' ? 'text-warning' : 'text-muted-foreground'
                            )}>
                              {urgencyLabel(p)}
                              {p.source === 'fixed_bill' && ' · Conta fixa'}
                              {p.source === 'card_invoice' && ' · Calculada pelo cartão'}
                            </p>
                          </div>
                          <p className="text-sm font-semibold font-mono">{formatCurrency(p.amount)}</p>
                          {p.source === 'transaction' || p.source === 'card_invoice' ? (
                            <button
                              onClick={() => handleMarkPaid(p)}
                              className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center border border-border text-muted-foreground hover:text-success hover:border-success/50 hover:bg-success/10 transition-colors"
                              title="Marcar como pago"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          ) : (
                            <span className="h-9 w-9 shrink-0" />
                          )}
                        </div>
                      ))}
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
