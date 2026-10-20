// Date and due date of a recurring transaction's occurrence in the given month, or null if none.
export function projectOccurrence(r: any, year: number, monIdx: number): { date: string; due_date: string | null } | null {
  const endDate = new Date(year, monIdx + 1, 0);
  const monthStartTs = new Date(year, monIdx, 1).getTime();
  const monthEndTs = endDate.getTime();
  const intervalDays: Record<string, number> = { weekly: 7, biweekly: 14 };
  const toDateStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

  const baseDate = new Date(r.date + 'T00:00:00');
  if (baseDate.getTime() > monthEndTs) return null; // starts after this month
  const endLimit = r.recurrence_end_date
    ? new Date(r.recurrence_end_date + 'T00:00:00').getTime()
    : null;
  if (endLimit !== null && monthStartTs > endLimit) return null; // ended before this month
  const interval = r.recurrence_interval || 'monthly';
  const dueDateOriginal = r.due_date ? new Date(r.due_date + 'T00:00:00') : null;
  // For weekly/biweekly, preserve the day gap between registration and due date
  const dueOffsetMs = dueDateOriginal ? dueDateOriginal.getTime() - baseDate.getTime() : null;
  // For monthly/yearly, preserve the fixed due day-of-month (and month offset), so it doesn't drift with month length
  const dueMonthDelta = dueDateOriginal
    ? (dueDateOriginal.getFullYear() * 12 + dueDateOriginal.getMonth()) - (baseDate.getFullYear() * 12 + baseDate.getMonth())
    : null;

  let occurrence: Date | null = null;
  if (interval === 'monthly') {
    const day = Math.min(baseDate.getDate(), endDate.getDate());
    const candidate = new Date(year, monIdx, day);
    if (candidate.getTime() >= baseDate.getTime() && candidate.getTime() <= monthEndTs) {
      occurrence = candidate;
    }
  } else if (interval === 'yearly') {
    if (baseDate.getMonth() === monIdx) {
      const day = Math.min(baseDate.getDate(), endDate.getDate());
      const candidate = new Date(year, monIdx, day);
      if (candidate.getTime() >= baseDate.getTime()) occurrence = candidate;
    }
  } else if (interval === 'weekly' || interval === 'biweekly') {
    const step = intervalDays[interval];
    const diffMs = monthStartTs - baseDate.getTime();
    const stepsToFirst = Math.max(0, Math.ceil(diffMs / (step * 86400000)));
    const firstTs = baseDate.getTime() + stepsToFirst * step * 86400000;
    if (firstTs <= monthEndTs) occurrence = new Date(firstTs);
  }

  if (!occurrence || (endLimit !== null && occurrence.getTime() > endLimit)) return null;

  let virtualDueDate: string | null = null;
  if (dueDateOriginal) {
    if (interval === 'monthly' || interval === 'yearly') {
      const dueMonthIdx = occurrence.getMonth() + (dueMonthDelta ?? 0);
      const dueYear = occurrence.getFullYear() + Math.floor(dueMonthIdx / 12);
      const normalizedDueMonthIdx = ((dueMonthIdx % 12) + 12) % 12;
      const lastDayOfDueMonth = new Date(dueYear, normalizedDueMonthIdx + 1, 0).getDate();
      const dueDay = Math.min(dueDateOriginal.getDate(), lastDayOfDueMonth);
      virtualDueDate = toDateStr(new Date(dueYear, normalizedDueMonthIdx, dueDay));
    } else if (dueOffsetMs !== null) {
      virtualDueDate = toDateStr(new Date(occurrence.getTime() + dueOffsetMs));
    }
  }
  return { date: toDateStr(occurrence), due_date: virtualDueDate };
}

// Transactions shown in a month: real rows dated or due in it, plus projected occurrences of
// recurring series. A projected month that was already saved as its own row is not projected again.
export function buildMonth(all: any[], month: string): any[] {
  const [year, mon] = month.split('-').map(Number);
  const monIdx = mon - 1;
  const start = `${month}-01`;
  const end = `${month}-${new Date(year, monIdx + 1, 0).getDate().toString().padStart(2, '0')}`;
  const inMonth = (d: string | null) => !!d && d >= start && d <= end;

  const map = new Map<string, any>();
  for (const t of all) {
    if (inMonth(t.date) || inMonth(t.due_date)) map.set(t.id, t);
  }

  const realRows = Array.from(map.values());
  for (const r of all) {
    if (!r.is_recurring || map.has(r.id)) continue; // already in this month as real entry
    const occ = projectOccurrence(r, year, monIdx);
    if (!occ) continue;
    const materialized = realRows.some(t =>
      !t.is_recurring && t.date === occ.date && t.description === r.description && t.type === r.type
    );
    if (materialized) continue;
    map.set(`${r.id}-virtual-${occ.date}`, {
      ...r,
      id: `${r.id}-virtual-${occ.date}`,
      original_id: r.id,
      series_date: r.date,
      is_virtual: true,
      date: occ.date,
      due_date: occ.due_date,
      status: 'pending',
    });
  }

  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}
