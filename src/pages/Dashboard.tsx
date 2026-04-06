import { AppLayout } from '@/components/layout/AppLayout';
import { useFinanceSummary, useTransactions, useFixedBills } from '@/hooks/useFinanceData';
import { formatCurrency, getDaysUntilDue, getDueDateStatus, getCompromiseLevel } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Target, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const CHART_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#6366F1', '#14B8A6', '#6B7280'];

export default function Dashboard() {
  const summary = useFinanceSummary();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const { data: transactions } = useTransactions(currentMonth);
  const { data: fixedBills } = useFixedBills();
  const navigate = useNavigate();

  const compromiseLevel = getCompromiseLevel(summary.compromisePercentage);
  const compromiseColor = compromiseLevel === 'safe' ? 'text-success' : compromiseLevel === 'attention' ? 'text-warning' : 'text-destructive';

  // Upcoming bills
  const upcomingBills = (fixedBills ?? [])
    .filter(b => b.is_active)
    .map(b => ({ ...b, daysUntil: getDaysUntilDue(b.due_day), dueDateStatus: getDueDateStatus(getDaysUntilDue(b.due_day)) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  // Category breakdown for pie chart
  const categoryTotals = (transactions ?? [])
    .filter(t => t.type === 'expense' && t.categories)
    .reduce((acc, t) => {
      const name = t.categories?.name ?? 'Outros';
      acc[name] = (acc[name] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Overdue transactions
  const overdueCount = (transactions ?? []).filter(t => t.status === 'pending' && t.due_date && new Date(t.due_date) < now).length;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Alert Banner */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Você tem {overdueCount} conta(s) vencida(s)!</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="col-span-2">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Atual</p>
                <p className={cn('text-2xl font-bold font-mono', summary.balance >= 0 ? 'money-positive' : 'money-negative')}>
                  {formatCurrency(summary.balance)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Projetado: {formatCurrency(summary.projectedBalance)}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-primary opacity-50" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Entradas</span>
              </div>
              <p className="text-lg font-bold font-mono money-positive">{formatCurrency(summary.income)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Saídas</span>
              </div>
              <p className="text-lg font-bold font-mono money-negative">{formatCurrency(summary.expenses)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Comprometido</span>
              </div>
              <p className={cn('text-lg font-bold font-mono', compromiseColor)}>
                {summary.compromisePercentage.toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs text-muted-foreground">Dívidas</span>
              </div>
              <p className="text-lg font-bold font-mono text-foreground">{formatCurrency(summary.totalDebt)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Próximos Vencimentos</h3>
                <button onClick={() => navigate('/transactions')} className="text-xs text-primary flex items-center gap-1">
                  Ver todos <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-2">
                {upcomingBills.map(bill => {
                  const statusColor = bill.dueDateStatus === 'overdue' ? 'border-l-destructive' :
                    bill.dueDateStatus === 'urgent' ? 'border-l-destructive' :
                    bill.dueDateStatus === 'warning' ? 'border-l-warning' : 'border-l-success';
                  return (
                    <div key={bill.id} className={cn('flex items-center justify-between py-2 pl-3 border-l-2 rounded-r-md', statusColor)}>
                      <div>
                        <p className="text-sm font-medium">{bill.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Dia {bill.due_day} • {bill.daysUntil < 0 ? `${Math.abs(bill.daysUntil)} dias atrás` : bill.daysUntil === 0 ? 'Hoje' : `em ${bill.daysUntil} dias`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono">{formatCurrency(Number(bill.amount))}</p>
                        <PriorityBadge priority={bill.priority} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3">Gastos por Categoria</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {pieData.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
