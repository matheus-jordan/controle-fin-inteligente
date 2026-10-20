import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCategories, useTransactions, useCreateCategory, useSetTransactionsCategory } from '@/hooks/useFinanceData';
import { suggestCategory, normalize, NEW_CATEGORIES } from '@/lib/autoCategory';
import { formatCurrency } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, Sparkles, Tags, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Group {
  key: string;
  description: string;
  type: 'income' | 'expense';
  ids: string[];
  count: number;
  total: number;
  recurring: boolean;
}

// Choice values: an existing category id, "new:<name>" for a category to create, or "custom" for a typed name
const NEW_PREFIX = 'new:';

export default function Categorize() {
  const navigate = useNavigate();
  const { data: categories } = useCategories();
  const { data: all, isLoading } = useTransactions();
  const createCategory = useCreateCategory();
  const setCategory = useSetTransactionsCategory();

  const [choices, setChoices] = useState<Record<string, string>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const t of all ?? []) {
      if (t.category_id) continue;
      const key = `${t.type}|${normalize(t.description)}`;
      const g = map.get(key) ?? { key, description: t.description, type: t.type, ids: [], count: 0, total: 0, recurring: false };
      g.ids.push(t.id);
      g.count += 1;
      g.total += Number(t.amount);
      g.recurring ||= t.is_recurring;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [all]);

  const cats = categories ?? [];
  const suggestionFor = (g: Group) => {
    const s = suggestCategory(g.description, g.type, cats);
    if (!s) return '';
    return s.isNew ? NEW_PREFIX + s.name : cats.find(c => c.type === g.type && c.name === s.name)!.id;
  };
  const choiceFor = (g: Group) => choices[g.key] ?? suggestionFor(g);
  const withChoice = groups.filter(g => {
    const c = choiceFor(g);
    return c && (c !== 'custom' || customNames[g.key]?.trim());
  });

  // Resolves a choice to a category id, creating the category when needed.
  const resolve = async (g: Group, choice: string, created: Map<string, string>): Promise<string> => {
    if (choice !== 'custom' && !choice.startsWith(NEW_PREFIX)) return choice;
    const name = choice === 'custom' ? customNames[g.key].trim() : choice.slice(NEW_PREFIX.length);
    const cacheKey = `${g.type}|${normalize(name)}`;
    const existing = created.get(cacheKey) ?? cats.find(c => c.type === g.type && normalize(c.name) === normalize(name))?.id;
    if (existing) return existing;
    const spec = NEW_CATEGORIES.find(n => n.name === name && n.type === g.type);
    const row = await createCategory.mutateAsync({
      name,
      type: g.type,
      color: spec?.color ?? '#6B7280',
      icon: spec?.icon ?? 'circle',
    });
    created.set(cacheKey, row.id);
    return row.id;
  };

  const apply = async (list: Group[]) => {
    setBusy(true);
    const created = new Map<string, string>();
    let done = 0;
    let blockedNew = false;
    for (const g of list) {
      const choice = choiceFor(g);
      if (!choice) continue;
      try {
        const categoryId = await resolve(g, choice, created);
        await setCategory.mutateAsync({ ids: g.ids, categoryId });
        done += 1;
      } catch {
        if (choice === 'custom' || choice.startsWith(NEW_PREFIX)) blockedNew = true;
      }
    }
    setBusy(false);
    if (done) toast.success(`${done} grupo${done > 1 ? 's' : ''} categorizado${done > 1 ? 's' : ''}`);
    if (blockedNew) toast.error('Não deu para criar categorias novas: o banco ainda precisa da atualização de categorias por usuário.');
  };

  const optionsFor = (type: 'income' | 'expense') => {
    const own = cats.filter(c => c.type === type);
    const suggestedNew = groups
      .filter(g => g.type === type)
      .map(g => suggestCategory(g.description, g.type, cats))
      .filter(s => s?.isNew)
      .map(s => s!.name);
    const names = Array.from(new Set([...suggestedNew, ...NEW_CATEGORIES.filter(n => n.type === type).map(n => n.name)]));
    const creatable = names
      .filter(n => !own.some(c => normalize(c.name) === normalize(n)))
      .map(name => ({ name }));
    return { own, creatable };
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60" title="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">Organizar categorias</h2>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <PartyPopper className="h-8 w-8 text-success" />
            Todos os lançamentos têm categoria
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-sm">
                <span className="font-semibold">{groups.reduce((s, g) => s + g.count, 0)} lançamentos</span> sem categoria, em {groups.length} grupo{groups.length > 1 ? 's' : ''} pela descrição.
                <span className="text-muted-foreground"> Sugestões marcadas com <Sparkles className="inline h-3.5 w-3.5 text-[hsl(var(--glow))]" />. Confira e aplique.</span>
              </p>
              <Button className="w-full rounded-full" disabled={busy || withChoice.length === 0} onClick={() => apply(withChoice)}>
                <Check className="h-4 w-4 mr-1" />
                {busy ? 'Aplicando...' : `Aplicar ${withChoice.length} categoria${withChoice.length !== 1 ? 's' : ''}`}
              </Button>
            </div>

            <div className="glass-flat rounded-2xl divide-y divide-border">
              {groups.map(g => {
                const choice = choiceFor(g);
                const suggested = suggestionFor(g);
                const { own, creatable } = optionsFor(g.type);
                return (
                  <div key={g.key} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{g.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.type === 'income' ? 'Entrada' : 'Saída'}
                          {g.recurring ? ' · recorrente' : ''}
                          {g.count > 1 ? ` · ${g.count} lançamentos` : ''}
                        </p>
                      </div>
                      <p className={cn('text-sm font-semibold font-mono shrink-0', g.type === 'income' ? 'money-positive' : 'money-negative')}>
                        {formatCurrency(g.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={choice || undefined} onValueChange={(v) => setChoices(c => ({ ...c, [g.key]: v }))}>
                        <SelectTrigger className={cn('flex-1 rounded-full h-9 justify-start [&>svg:last-child]:ml-auto', !choice && 'text-muted-foreground')}>
                          {choice && choice === suggested && <Sparkles className="h-3.5 w-3.5 shrink-0 mr-1.5 text-[hsl(var(--glow))]" />}
                          <SelectValue placeholder="Escolher categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Suas categorias</SelectLabel>
                            {own.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Criar nova</SelectLabel>
                            {creatable.map(n => <SelectItem key={n.name} value={NEW_PREFIX + n.name}>+ {n.name}</SelectItem>)}
                            <SelectItem value="custom">+ Outro nome...</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="rounded-full h-9" disabled={busy || !choice || (choice === 'custom' && !customNames[g.key]?.trim())} onClick={() => apply([g])}>
                        Aplicar
                      </Button>
                    </div>
                    {choice === 'custom' && (
                      <Input
                        value={customNames[g.key] ?? ''}
                        onChange={(e) => setCustomNames(n => ({ ...n, [g.key]: e.target.value }))}
                        placeholder="Nome da nova categoria"
                        className="rounded-full h-9"
                        maxLength={40}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
              <Tags className="h-3.5 w-3.5" /> Em contas recorrentes, a categoria vale para todos os meses da série.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
