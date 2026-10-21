import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCategories, useTransactions, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useFinanceData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Pencil, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type CatType = 'expense' | 'income';

const colors = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F472B6', '#64748B', '#6B7280'];

const NOT_EDITABLE_MSG = 'Essa categoria ainda é a padrão do app e não pode ser alterada. Aplique a atualização de categorias por usuário no banco.';

export default function Categories() {
  const navigate = useNavigate();
  const { data: categories, isLoading } = useCategories();
  const { data: all } = useTransactions();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [tab, setTab] = useState<CatType>('expense');
  const [editing, setEditing] = useState<{ id: string | null; name: string; color: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [moveTo, setMoveTo] = useState<string>('none');

  const usage = (all ?? []).reduce((acc, t) => {
    if (t.category_id) acc[t.category_id] = (acc[t.category_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const list = (categories ?? []).filter(c => c.type === tab);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      toast.error('Informe o nome da categoria');
      return;
    }
    if (list.some(c => c.id !== editing.id && c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Já existe uma categoria com esse nome');
      return;
    }
    try {
      if (editing.id) await updateCategory.mutateAsync({ id: editing.id, name, color: editing.color });
      else await createCategory.mutateAsync({ name, type: tab, color: editing.color, icon: 'circle' });
      toast.success(editing.id ? 'Categoria atualizada' : 'Categoria criada');
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'not_editable' ? NOT_EDITABLE_MSG : 'Não foi possível salvar. Se for uma categoria nova, o banco precisa da atualização de categorias por usuário.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory.mutateAsync({ id: deleting.id, moveTo: moveTo === 'none' ? null : moveTo });
      toast.success('Categoria excluída');
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'not_editable' ? NOT_EDITABLE_MSG : 'Não foi possível excluir a categoria');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60" title="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold flex-1">Categorias</h2>
          <Button size="sm" className="rounded-full" onClick={() => setEditing({ id: null, name: '', color: colors[7] })}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>

        <div className="glass-flat rounded-full flex p-1 gap-1">
          {(['expense', 'income'] as CatType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('flex-1 rounded-full py-1.5 text-sm font-medium transition-colors',
                tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {t === 'expense' ? 'Saídas' : 'Entradas'}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/categorize')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl glass-flat text-sm text-left hover:border-primary/40 transition-colors"
        >
          <Wand2 className="h-4 w-4 shrink-0 text-[hsl(var(--glow))]" />
          <span className="flex-1">Organizar lançamentos sem categoria</span>
        </button>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhuma categoria</p>
        ) : (
          <div className="glass-flat rounded-2xl divide-y divide-border overflow-hidden">
            {list.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {usage[c.id] ? `${usage[c.id]} lançamento${usage[c.id] > 1 ? 's' : ''}` : 'Sem lançamentos'}
                  </p>
                </div>
                <button onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60" title="Editar">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={() => { setMoveTo('none'); setDeleting({ id: c.id, name: c.name }); }} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-destructive/10" title="Excluir">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto max-w-2xl mx-auto">
          <SheetHeader>
            <SheetTitle>{editing?.id ? 'Editar categoria' : `Nova categoria de ${tab === 'expense' ? 'saída' : 'entrada'}`}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={40} className="mt-1" autoFocus />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {colors.map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditing({ ...editing, color: col })}
                      className={cn('w-8 h-8 rounded-full border-2 transition-all', editing.color === col ? 'border-foreground scale-110' : 'border-transparent')}
                      style={{ backgroundColor: col }}
                      title={col}
                    />
                  ))}
                </div>
              </div>
              {editing.id && (usage[editing.id] ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">O novo nome vale para os {usage[editing.id]} lançamentos dessa categoria.</p>
              )}
              <Button onClick={save} className="w-full h-12" disabled={createCategory.isPending || updateCategory.isPending}>
                {createCategory.isPending || updateCategory.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="glass-strong">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && usage[deleting.id]
                ? `Ela tem ${usage[deleting.id]} lançamento${usage[deleting.id] > 1 ? 's' : ''}. Escolha para onde ${usage[deleting.id] > 1 ? 'eles vão' : 'ele vai'}.`
                : 'Nenhum lançamento usa essa categoria.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting && !!usage[deleting.id] && (
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Deixar sem categoria</SelectItem>
                {list.filter(c => c.id !== deleting.id).map(c => (
                  <SelectItem key={c.id} value={c.id}>Mover para {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
