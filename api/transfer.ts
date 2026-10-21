// One-time move of the signed-in user's data from the old database (Lovable) to the new one (Vercel Supabase).
// Reads the old database with the user's own session (so only their rows), creates the same email in the new
// database with the password they chose, copies every table and checks the counts. The old database is never written.
import { createClient } from '@supabase/supabase-js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Parents before children (card_expenses points to credit_cards)
const DATA_TABLES = ['credit_cards', 'card_expenses', 'transactions', 'debts', 'fixed_bills'] as const;
const PAGE = 1000;

async function readAll(client: any, table: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function POST(request: Request): Promise<Response> {
  const oldUrl = process.env.VITE_SUPABASE_URL;
  const oldKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const newUrl = process.env.SUPABASE_URL;
  const newServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!oldUrl || !oldKey || !newUrl || !newServiceKey) return json({ error: 'not_configured' }, 503);

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 6) return json({ error: 'weak_password' }, 400);

  // Who is asking: validated by the old database itself
  const oldDb = createClient(oldUrl, oldKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: who, error: whoErr } = await oldDb.auth.getUser(auth.slice('Bearer '.length));
  if (whoErr || !who.user?.email) return json({ error: 'unauthorized' }, 401);
  const email = who.user.email;

  const newDb = createClient(newUrl, newServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1. Read everything the user owns in the old database
    const oldCategories = await readAll(oldDb, 'categories');
    const oldData: Record<string, any[]> = {};
    for (const t of DATA_TABLES) oldData[t] = await readAll(oldDb, t);

    // 2. Same email in the new database, already confirmed, with the chosen password (re-runs reuse it)
    let newUserId: string | null = null;
    const created = await newDb.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.data.user) {
      newUserId = created.data.user.id;
    } else {
      for (let page = 1; !newUserId; page++) {
        const { data, error } = await newDb.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(`list users: ${error.message}`);
        newUserId = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
        if (data.users.length < 200) break;
      }
      if (!newUserId) throw new Error(`create user: ${created.error?.message}`);
      const upd = await newDb.auth.admin.updateUserById(newUserId, { password, email_confirm: true });
      if (upd.error) throw new Error(`update user: ${upd.error.message}`);
    }

    // 3. Categories: match by name and type, create the ones the new account doesn't have
    const { data: newCats, error: catErr } = await newDb.from('categories').select('*').eq('user_id', newUserId);
    if (catErr) throw new Error(`read new categories: ${catErr.message}`);
    const key = (c: any) => `${c.type}|${String(c.name).trim().toLowerCase()}`;
    const byKey = new Map((newCats ?? []).map(c => [key(c), c.id]));
    const usedIds = new Set(Object.values(oldData).flat().map(r => r.category_id).filter(Boolean));
    const categoryMap = new Map<string, string>();
    for (const c of oldCategories) {
      if (!usedIds.has(c.id) && c.user_id !== who.user.id) continue; // unused shared defaults are already there
      let id = byKey.get(key(c));
      if (!id) {
        const { data, error } = await newDb
          .from('categories')
          .insert({ name: c.name, type: c.type, icon: c.icon, color: c.color, user_id: newUserId })
          .select('id')
          .single();
        if (error) throw new Error(`create category ${c.name}: ${error.message}`);
        id = data.id as string;
        byKey.set(key(c), id);
      }
      categoryMap.set(c.id, id);
    }

    // 4. Copy rows keeping their ids (so a re-run updates instead of duplicating)
    for (const t of DATA_TABLES) {
      const rows = oldData[t].map(r => {
        const row: any = { ...r, user_id: newUserId };
        if ('category_id' in row) row.category_id = r.category_id ? categoryMap.get(r.category_id) ?? null : null;
        return row;
      });
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await newDb.from(t).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
        if (error) throw new Error(`copy ${t}: ${error.message}`);
      }
    }

    // 5. Check: every table has the same number of rows on both sides
    const counts: Record<string, { antes: number; depois: number }> = {};
    for (const t of DATA_TABLES) {
      const { count, error } = await newDb.from(t).select('id', { count: 'exact', head: true }).eq('user_id', newUserId);
      if (error) throw new Error(`count ${t}: ${error.message}`);
      counts[t] = { antes: oldData[t].length, depois: count ?? 0 };
    }
    const ok = Object.values(counts).every(c => c.antes === c.depois);
    return json({ ok, email, counts }, ok ? 200 : 500);
  } catch (err) {
    return json({ error: 'transfer_failed', detail: err instanceof Error ? err.message : String(err) }, 500);
  }
}
