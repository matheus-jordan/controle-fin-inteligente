// Applies pending SQL files from supabase/migrations to the production database during the Vercel build.
// Runs only on production builds that have the database URL; local and preview builds skip it.
// Each file runs in its own transaction and is recorded in public.schema_migrations, so it never runs twice.
import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.POSTGRES_URL_NON_POOLING;
if (process.env.VERCEL_ENV !== 'production' || !url) {
  console.log('[migrate] skipped (not a production build with a database)');
  process.exit(0);
}

const dir = new URL('../supabase/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

// Supabase certificates chain to Supabase's own root CA (public file kept next to this script), so verify against it
const client = new pg.Client({
  connectionString: url.replace(/[?&]sslmode=[^&]*/, ''),
  ssl: { ca: readFileSync(new URL('./supabase-root-2021-ca.crt', import.meta.url), 'utf8') },
});
await client.connect();
try {
  // Two builds can start together (git push + CLI deploy): only one migrates at a time
  await client.query('SELECT pg_advisory_lock(727274)');
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await client.query('SELECT name FROM public.schema_migrations');
  const applied = new Set(rows.map(r => r.name));
  const pending = files.filter(f => !applied.has(f));
  console.log(`[migrate] ${files.length} files, ${pending.length} pending`);
  for (const file of pending) {
    const sql = readFileSync(new URL(file, dir), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] failed on ${file}: ${err.message}`);
      throw err;
    }
  }
} finally {
  await client.end();
}
