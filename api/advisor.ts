// Financial assistant endpoint (Vercel Function). Answers questions from a summary of the user's own data.
// Requires ANTHROPIC_API_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the Vercel project env.
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `Você é o assistente financeiro pessoal dentro de um app de controle de gastos. Fala com uma pessoa só, sobre o dinheiro dela, em português do Brasil.

Você recebe, em <dados>, um resumo real dos lançamentos dela: o mês atual item a item e o histórico dos últimos 6 meses (entradas, saídas, sobra, gastos essenciais x estilo de vida, gastos por categoria), além das recomendações automáticas que o app já calculou.

Como responder:
- Baseie tudo nos números de <dados>. Cite valores e meses concretos. Se a resposta depende de algo que não está nos dados, diga o que falta em vez de supor.
- Compare com o próprio histórico dela antes de comparar com regras gerais. A referência 50/30/20 (essenciais/estilo de vida/sobra) serve só de régua.
- Seja simples e direto: frases curtas, sem jargão. Quando der conselho, termine com no máximo 3 ações práticas, cada uma com valor ou prazo.
- Respostas curtas: até uns 150 palavras, a menos que a pergunta peça detalhe.
- Não recomende produtos financeiros específicos (fundos, ações, bancos, cripto). Pode falar em reserva de emergência, guardar uma parte da renda e quitar dívidas caras.
- Não use travessão (—). Use vírgula, ponto ou dois-pontos.
- Formatação: texto corrido e listas simples com "-". Sem títulos, sem tabelas.`;

const MAX_QUESTION = 1000;
const MAX_CONTEXT = 60_000;
const MAX_HISTORY = 10;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(request: Request): Promise<Response> {
  // Only signed-in users of the app can spend the API key
  const auth = request.headers.get('authorization');
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!auth?.startsWith('Bearer ') || !supabaseUrl || !supabaseKey) return json({ error: 'unauthorized' }, 401);
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: auth, apikey: supabaseKey } });
  if (!userRes.ok) return json({ error: 'unauthorized' }, 401);

  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503);

  let body: { question?: unknown; context?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const context = JSON.stringify(body.context ?? {});
  if (!question || question.length > MAX_QUESTION || context.length > MAX_CONTEXT) return json({ error: 'invalid_body' }, 400);
  const history: Turn[] = Array.isArray(body.history)
    ? (body.history as Turn[])
        .filter(t => (t?.role === 'user' || t?.role === 'assistant') && typeof t.content === 'string')
        .slice(-MAX_HISTORY)
        .map(t => ({ role: t.role, content: t.content.slice(0, 4000) }))
    : [];
  // Conversation must start with a user turn
  while (history.length && history[0].role !== 'user') history.shift();

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        ...history,
        { role: 'user', content: `<dados>\n${context}\n</dados>\n\n${question}` },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return json({ answer: 'Não consegui responder essa pergunta. Tente reformular falando dos seus gastos ou da sua renda.' });
    }
    const answer = response.content
      .flatMap(block => (block.type === 'text' ? [block.text] : []))
      .join('\n')
      .trim();
    return json({ answer: answer || 'Não consegui gerar uma resposta agora. Tente de novo.' });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'rate_limited' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'not_configured' }, 503);
    if (err instanceof Anthropic.APIError) return json({ error: 'upstream', status: err.status }, 502);
    return json({ error: 'upstream' }, 502);
  }
}
