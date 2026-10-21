import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle2, DatabaseZap, Loader2, XCircle } from 'lucide-react';

const tableLabels: Record<string, string> = {
  transactions: 'Lançamentos',
  credit_cards: 'Cartões',
  card_expenses: 'Gastos de cartão',
  debts: 'Dívidas',
  fixed_bills: 'Contas fixas',
};

type Result = { ok: boolean; email?: string; counts?: Record<string, { antes: number; depois: number }>; error?: string; detail?: string };

export default function Transfer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canRun = password.length >= 6 && password === confirm && !running;

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: 'upstream' }));
      setResult({ ok: res.ok && body.ok, ...body });
    } catch {
      setResult({ ok: false, error: 'network' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent/60" title="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold">Transferir para o novo banco</h2>
        </div>

        <div className="glass rounded-2xl p-4 space-y-2 text-sm">
          <p>Copia todos os seus dados para o banco novo e cria lá a sua conta com o e-mail <span className="font-semibold">{user?.email}</span>.</p>
          <p className="text-muted-foreground">O banco atual não é alterado. Se der algo errado, nada se perde e dá para rodar de novo.</p>
        </div>

        {!result?.ok && (
          <div className="glass rounded-2xl p-4 space-y-4">
            <div>
              <Label>Senha da conta nova</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="mt-1" autoComplete="new-password" />
            </div>
            <div>
              <Label>Repita a senha</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" autoComplete="new-password" />
              {mismatch && <p className="text-xs text-destructive mt-1">As senhas não batem</p>}
            </div>
            <p className="text-xs text-muted-foreground">Pode ser a mesma senha que você usa hoje. É com ela que você vai entrar depois da troca.</p>
            <Button className="w-full h-12 rounded-full" disabled={!canRun} onClick={run}>
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transferindo...</> : <><DatabaseZap className="h-4 w-4 mr-2" /> Transferir</>}
            </Button>
          </div>
        )}

        {result && (
          <div className={result.ok ? 'rounded-2xl border p-4 space-y-3 bg-success/10 border-success/25' : 'rounded-2xl border p-4 space-y-3 bg-destructive/10 border-destructive/25'}>
            <p className="flex items-center gap-2 font-semibold">
              {result.ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
              {result.ok ? 'Transferência concluída e conferida' : 'A transferência não terminou'}
            </p>
            {result.counts && (
              <div className="divide-y divide-border text-sm">
                {Object.entries(result.counts).map(([t, c]) => (
                  <div key={t} className="flex justify-between py-1.5">
                    <span>{tableLabels[t] ?? t}</span>
                    <span className="font-mono">{c.antes} → {c.depois} {c.antes === c.depois ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}
            {result.ok ? (
              <p className="text-sm text-muted-foreground">Pronto. Avise no chat para eu trocar o app para o banco novo.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {result.error === 'weak_password' ? 'A senha precisa ter pelo menos 6 caracteres.'
                  : result.error === 'unauthorized' ? 'Sua sessão expirou. Saia, entre de novo e tente outra vez.'
                  : `Nada foi perdido. Tente de novo; se repetir, mande esta mensagem no chat: ${result.detail ?? result.error}`}
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
