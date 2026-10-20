import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions } from '@/hooks/useFinanceData';
import { advisorContext } from '@/lib/report';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Sparkles, SendHorizontal, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Turn = { role: 'user' | 'assistant'; content: string };

const suggestions = [
  'Como está a distribuição da minha renda?',
  'Onde dá para cortar este mês?',
  'Quanto consigo guardar por mês?',
  'O que mudou em relação aos meses anteriores?',
];

const errorMessages: Record<string, string> = {
  not_configured: 'O assistente ainda não foi configurado (falta a chave da IA no servidor).',
  unauthorized: 'Sua sessão expirou. Saia e entre de novo.',
  rate_limited: 'Muitas perguntas seguidas. Espere um minuto e tente de novo.',
};

export default function Assistant() {
  const { data: all } = useTransactions();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, loading]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setInput('');
    const history = turns;
    setTurns([...history, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ question: q, history, context: advisorContext(all ?? [], currentMonth) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.answer) throw new Error(body.error ?? 'upstream');
      setTurns(t => [...t, { role: 'assistant', content: body.answer }]);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'upstream';
      setError(errorMessages[code] ?? 'Não consegui falar com o assistente agora. Tente de novo.');
      setTurns(history); // drop the unanswered question so it can be retried
      setInput(q);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[hsl(var(--glow))]" />
          <h2 className="text-lg font-bold">Assistente</h2>
        </div>

        {turns.length === 0 && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Pergunte sobre seus gastos. O assistente olha os seus lançamentos dos últimos 6 meses para responder.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  disabled={loading}
                  className="glass-flat rounded-full px-3 py-1.5 text-xs text-left hover:border-primary/50 hover:text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                  t.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass rounded-bl-md')}
              >
                {t.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando seus lançamentos...
              </div>
            </div>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="sticky bottom-24 glass-strong rounded-full flex items-center gap-2 p-1.5 pl-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seus gastos..."
            maxLength={1000}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            title="Enviar"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
