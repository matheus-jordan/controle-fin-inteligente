import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useFinanceData';
import { monthHistory, buildInsights, UNCATEGORIZED, type Insight } from '@/lib/report';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { MonthNav } from '@/components/shared/MonthNav';
import { AlertTriangle, CheckCircle2, Info, XCircle, ArrowUpRight, ArrowDownRight, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

const toneStyle: Record<Insight['tone'], { icon: typeof Info; cls: string }> = {
  good: { icon: CheckCircle2, cls: 'text-success bg-success/10 border-success/25' },
  warn: { icon: AlertTriangle, cls: 'text-warning bg-warning/10 border-warning/25' },
  bad: { icon: XCircle, cls: 'text-destructive bg-destructive/10 border-destructive/25' },
  info: { icon: Info, cls: 'text-primary bg-primary/10 border-primary/25' },
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const shortMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

export default function Reports() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const navigate = useNavigate();
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentMonth = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const { data: all, isLoading } = useTransactions();
  const history = monthHistory(all ?? [], currentMonth, 6);
  const current = history[history.length - 1];
  const previous = history.slice(0, -1);
  const insights = buildInsights(current, previous);

  // Category averages over previous months that have data, for the comparison arrows
  const pastWithData = previous.filter(m => m.txCount > 0).slice(-3);
  const categoryAvg = (name: string) =>
    pastWithData.length ? pastWithData.reduce((s, m) => s + (m.byCategory[name] ?? 0), 0) / pastWithData.length : null;
  const categories = Object.entries(current.byCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory = categories[0]?.[1] ?? 0;

  // Income distribution (part-to-whole of income)
  const base = Math.max(current.income, current.expenses, 1);
  const distribution = [
    { key: 'needs', label: 'Essenciais', value: current.needs, color: 'bg-[hsl(var(--viz-1))]', ref: 'até 50%' },
    { key: 'life', label: 'Estilo de vida', value: current.lifestyle, color: 'bg-[hsl(var(--viz-2))]', ref: 'até 30%' },
    { key: 'left', label: 'Sobra', value: Math.max(0, current.leftover), color: 'bg-[hsl(var(--viz-3))]', ref: '20% ou mais' },
  ];

  const maxTrend = Math.max(...history.map(m => Math.max(m.income, m.expenses)), 1);
  const selected = selectedBar !== null ? history[selectedBar] : null;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold">Relatórios</h2>
        <MonthNav label={monthLabel} onPrev={() => setMonthOffset(o => o - 1)} onNext={() => setMonthOffset(o => o + 1)} />

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : current.txCount === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhum lançamento neste mês</p>
        ) : (
          <>
            {(all ?? []).some(t => !t.category_id) && (
              <button
                onClick={() => navigate('/categorize')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/25 text-sm text-left hover:bg-primary/15 transition-colors"
              >
                <Tags className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">Há lançamentos sem categoria deixando o relatório incompleto</span>
                <span className="text-primary font-medium">Organizar</span>
              </button>
            )}

            {/* What to do */}
            {insights.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">O que fazer agora</h3>
                {insights.map((ins, i) => {
                  const { icon: Icon, cls } = toneStyle[ins.tone];
                  return (
                    <div key={i} className={cn('rounded-2xl border p-4 flex gap-3', cls)}>
                      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{ins.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Income distribution */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold">Para onde vai sua renda</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Renda de {formatCurrency(current.income)} · essenciais = prioridade Essencial e Crítico
                </p>
                <div className="flex h-3 gap-[2px] rounded-full overflow-hidden mt-4 bg-muted">
                  {distribution.filter(d => d.value > 0).map(d => (
                    <div key={d.key} className={cn(d.color, 'first:rounded-l-full last:rounded-r-full')} style={{ width: `${(d.value / base) * 100}%` }} title={`${d.label}: ${formatCurrency(d.value)}`} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {distribution.map(d => (
                    <div key={d.key}>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('h-2 w-2 rounded-full', d.color)} />{d.label}
                      </p>
                      <p className="text-base font-semibold font-mono mt-0.5">
                        {current.income > 0 ? pct(d.value / current.income) : 'n/d'}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{formatCurrency(d.value)}</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5">Referência: {d.ref}</p>
                    </div>
                  ))}
                </div>
                {current.leftover < 0 && (
                  <p className="text-xs text-destructive mt-3">Saídas passam a renda em {formatCurrency(-current.leftover)}.</p>
                )}
              </CardContent>
            </Card>

            {/* Spending by category */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Gastos por categoria</h3>
                  <p className="text-xs text-muted-foreground font-mono">{formatCurrency(current.expenses)}</p>
                </div>
                {pastWithData.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">Setas comparam com a média dos últimos {pastWithData.length} meses</p>
                )}
                <div className="space-y-3 mt-4">
                  {categories.map(([name, value]) => {
                    const avg = name === UNCATEGORIZED ? null : categoryAvg(name);
                    const delta = avg && avg > 0 ? (value - avg) / avg : null;
                    return (
                      <div key={name}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{name}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            {delta !== null && Math.abs(delta) >= 0.05 && (
                              <span className={cn('flex items-center text-xs', delta > 0 ? 'text-warning' : 'text-success')}>
                                {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {pct(Math.abs(delta))}
                              </span>
                            )}
                            <span className="font-mono font-semibold">{formatCurrency(value)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[hsl(var(--viz-1))]" style={{ width: `${(value / maxCategory) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-9 text-right">{pct(value / Math.max(current.expenses, 1))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 6-month trend */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Últimos 6 meses</h3>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--viz-1))]" />Entradas</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--viz-2))]" />Saídas</span>
                  </div>
                </div>
                <div className="flex items-end gap-2 h-36 mt-4 border-b border-border">
                  {history.map((m, i) => (
                    <button
                      key={m.month}
                      onClick={() => setSelectedBar(selectedBar === i ? null : i)}
                      className={cn('flex-1 h-full flex items-end justify-center gap-[2px] rounded-t-md transition-colors',
                        selectedBar === i ? 'bg-accent/50' : 'hover:bg-accent/30')}
                      title={`${shortMonth(m.month)}: entradas ${formatCurrency(m.income)}, saídas ${formatCurrency(m.expenses)}`}
                    >
                      <div className="w-2.5 rounded-t bg-[hsl(var(--viz-1))]" style={{ height: `${(m.income / maxTrend) * 100}%` }} />
                      <div className="w-2.5 rounded-t bg-[hsl(var(--viz-2))]" style={{ height: `${(m.expenses / maxTrend) * 100}%` }} />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1.5">
                  {history.map(m => (
                    <span key={m.month} className={cn('flex-1 text-center text-xs capitalize', m.month === currentMonth ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                      {shortMonth(m.month)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                  {selected ? (
                    <div className="flex justify-between gap-2">
                      <span className="capitalize font-semibold">{shortMonth(selected.month)}</span>
                      <span>Entradas <span className="font-mono">{formatCurrency(selected.income)}</span></span>
                      <span>Saídas <span className="font-mono">{formatCurrency(selected.expenses)}</span></span>
                      <span className={selected.leftover >= 0 ? 'money-positive' : 'money-negative'}>
                        <span className="font-mono">{formatCurrency(selected.leftover)}</span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Toque num mês para ver os valores</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top expenses */}
            {current.topExpenses.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Maiores gastos do mês</h3>
                  <div className="divide-y divide-border">
                    {current.topExpenses.map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{t.description}</p>
                          <p className="text-xs text-muted-foreground">{t.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold font-mono">{formatCurrency(t.amount)}</p>
                          {current.income > 0 && <p className="text-xs text-muted-foreground">{pct(t.amount / current.income)} da renda</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
