export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatShortDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(date));
}

export function getDaysUntilDue(dueDay: number): number {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let dueDate = new Date(currentYear, currentMonth, dueDay);
  if (dueDate < today) {
    dueDate = new Date(currentYear, currentMonth + 1, dueDay);
  }
  
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDueDateStatus(daysUntil: number): 'overdue' | 'urgent' | 'warning' | 'ok' {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 1) return 'urgent';
  if (daysUntil <= 3) return 'warning';
  return 'ok';
}

export function getCompromiseLevel(percentage: number): 'safe' | 'attention' | 'danger' {
  if (percentage < 50) return 'safe';
  if (percentage <= 80) return 'attention';
  return 'danger';
}

export type Priority = 'essential' | 'critical' | 'important' | 'optional';

export const priorityConfig: Record<Priority, { label: string; color: string; bgClass: string; textClass: string }> = {
  essential: { label: 'Essencial', color: '#EF4444', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
  critical: { label: 'Crítico', color: '#F97316', bgClass: 'bg-warning/10', textClass: 'text-warning' },
  important: { label: 'Importante', color: '#3B82F6', bgClass: 'bg-primary/10', textClass: 'text-primary' },
  optional: { label: 'Opcional', color: '#6B7280', bgClass: 'bg-muted', textClass: 'text-muted-foreground' },
};
