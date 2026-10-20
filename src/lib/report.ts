// Monthly aggregates and rule-based recommendations for the Reports screen and the assistant context.
import { buildMonth } from './recurrence';

export interface MonthStats {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  paid: number;
  leftover: number; // income - expenses
  needs: number; // essential + critical expenses
  lifestyle: number; // important + optional expenses
  byCategory: Record<string, number>;
  topExpenses: { description: string; amount: number; category: string }[];
  txCount: number;
}

export interface Insight {
  tone: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  detail: string;
  weight: number; // higher shows first
}

export const UNCATEGORIZED = 'Sem categoria';

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function monthStats(all: any[], month: string): MonthStats {
  const txs = buildMonth(all, month);
  const incomes = txs.filter(t => t.type === 'income');
  const expenses = txs.filter(t => t.type === 'expense');
  const sum = (list: any[]) => list.reduce((s, t) => s + Number(t.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const t of expenses) {
    const name = t.categories?.name ?? UNCATEGORIZED;
    byCategory[name] = (byCategory[name] ?? 0) + Number(t.amount);
  }

  const income = sum(incomes);
  const total = sum(expenses);
  return {
    month,
    income,
    expenses: total,
    paid: sum(expenses.filter(t => t.status === 'paid')),
    leftover: income - total,
    needs: sum(expenses.filter(t => t.priority === 'essential' || t.priority === 'critical')),
    lifestyle: sum(expenses.filter(t => t.priority !== 'essential' && t.priority !== 'critical')),
    byCategory,
    topExpenses: [...expenses]
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map(t => ({ description: t.description, amount: Number(t.amount), category: t.categories?.name ?? UNCATEGORIZED })),
    txCount: txs.length,
  };
}

// Stats for `count` months ending at `month` (oldest first).
export function monthHistory(all: any[], month: string, count: number): MonthStats[] {
  return Array.from({ length: count }, (_, i) => monthStats(all, shiftMonth(month, i - count + 1)));
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${Math.round(v * 100)}%`;

// Up to 3 simple actions for `current`, based on the months before it that have data.
export function buildInsights(current: MonthStats, previous: MonthStats[]): Insight[] {
  const past = previous.filter(m => m.txCount > 0).slice(-3);
  const out: Insight[] = [];

  if (current.income <= 0) {
    return current.expenses > 0
      ? [{ tone: 'info', title: 'Cadastre suas entradas', detail: 'Sem entradas neste mês não dá para medir quanto da renda cada gasto leva.', weight: 10 }]
      : [];
  }

  // 1. Leftover against income
  const leftoverPct = current.leftover / current.income;
  const pastLeftover = past.filter(m => m.income > 0).map(m => m.leftover / m.income);
  const avgPastLeftover = pastLeftover.length ? pastLeftover.reduce((s, v) => s + v, 0) / pastLeftover.length : null;
  const history = avgPastLeftover === null ? '' : ` Nos últimos ${pastLeftover.length} meses a média foi ${pct(avgPastLeftover)}.`;
  if (current.leftover < 0) {
    out.push({
      tone: 'bad',
      title: `O mês fecha no vermelho em ${brl(-current.leftover)}`,
      detail: `As saídas passam a renda.${history} Corte ou adie primeiro os gastos opcionais e importantes deste mês.`,
      weight: 100,
    });
  } else if (leftoverPct < 0.1) {
    out.push({
      tone: 'warn',
      title: `Sobra só ${pct(leftoverPct)} da renda`,
      detail: `Previsto sobrar ${brl(current.leftover)}.${history} Uma meta simples: separar ${brl(current.income * 0.1)} (10%) assim que o salário cair.`,
      weight: 80,
    });
  } else if (leftoverPct >= 0.2) {
    out.push({
      tone: 'good',
      title: `Boa margem: sobra ${pct(leftoverPct)} da renda`,
      detail: `Previsto sobrar ${brl(current.leftover)}.${history} Separe esse valor no início do mês para ele não virar gasto.`,
      weight: 30,
    });
  }

  // 2. Category above its own recent average
  if (past.length) {
    let worst: { name: string; diff: number; ratio: number } | null = null;
    for (const [name, value] of Object.entries(current.byCategory)) {
      if (name === UNCATEGORIZED) continue;
      const avg = past.reduce((s, m) => s + (m.byCategory[name] ?? 0), 0) / past.length;
      if (avg <= 0) continue;
      const diff = value - avg;
      if (diff >= 100 && diff / avg >= 0.2 && (!worst || diff > worst.diff)) worst = { name, diff, ratio: diff / avg };
    }
    if (worst) {
      out.push({
        tone: 'warn',
        title: `${worst.name} está ${brl(worst.diff)} acima da sua média`,
        detail: `Subiu ${pct(worst.ratio)} em relação aos últimos ${past.length} meses. Vale olhar os lançamentos dessa categoria antes de gastar mais nela.`,
        weight: 70,
      });
    }
  }

  // 3. Essentials weighing too much
  const needsPct = current.needs / current.income;
  if (needsPct > 0.6) {
    out.push({
      tone: 'warn',
      title: `Gastos essenciais levam ${pct(needsPct)} da renda`,
      detail: `A referência comum é até 50%. Com custo fixo alto, qualquer imprevisto aperta. Renegociar uma conta fixa grande tem mais efeito que cortar pequenos gastos.`,
      weight: 60,
    });
  }

  // 4. One category dominating income
  const top = Object.entries(current.byCategory).filter(([n]) => n !== UNCATEGORIZED).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] / current.income > 0.3) {
    out.push({
      tone: 'warn',
      title: `${top[0]} sozinha leva ${pct(top[1] / current.income)} da renda`,
      detail: `São ${brl(top[1])} no mês. É o primeiro lugar para procurar economia.`,
      weight: 50,
    });
  }

  // 5. Uncategorized spending hides the picture
  const uncategorized = current.byCategory[UNCATEGORIZED] ?? 0;
  if (current.expenses > 0 && uncategorized / current.expenses > 0.2) {
    out.push({
      tone: 'info',
      title: `${pct(uncategorized / current.expenses)} dos gastos estão sem categoria`,
      detail: 'Categorize esses lançamentos para o relatório e as recomendações ficarem precisos.',
      weight: 40,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

// Compact summary sent to the assistant (no ids, no personal data beyond descriptions and amounts).
export function advisorContext(all: any[], month: string) {
  const history = monthHistory(all, month, 6);
  const current = history[history.length - 1];
  const items = buildMonth(all, month).map(t => ({
    descricao: t.description,
    valor: Number(t.amount),
    tipo: t.type === 'income' ? 'entrada' : 'saida',
    categoria: t.categories?.name ?? UNCATEGORIZED,
    prioridade: t.priority,
    status: t.status,
    recorrente: !!t.is_recurring,
  })).slice(0, 80);
  return {
    mes_atual: month,
    lancamentos_mes_atual: items,
    historico_mensal: history.map(m => ({
      mes: m.month,
      entradas: Math.round(m.income),
      saidas: Math.round(m.expenses),
      sobra: Math.round(m.leftover),
      essenciais: Math.round(m.needs),
      estilo_de_vida: Math.round(m.lifestyle),
      por_categoria: Object.fromEntries(Object.entries(m.byCategory).map(([k, v]) => [k, Math.round(v)])),
    })),
    recomendacoes_automaticas: buildInsights(current, history.slice(0, -1)).map(i => `${i.title}. ${i.detail}`),
  };
}
