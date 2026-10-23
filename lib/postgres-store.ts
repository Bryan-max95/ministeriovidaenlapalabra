import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient } from 'pg';
import { NextRequest, NextResponse } from 'next/server';
import type { DatabaseSchema } from './types';

type State = { db: DatabaseSchema; dirty: boolean };
const context = new AsyncLocalStorage<State>();
const tables = ['users', 'forms', 'persons', 'visits'] as const;
let pool: Pool | undefined;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurada en el servidor.');
  const connectionUrl = new URL(process.env.DATABASE_URL);
  if (connectionUrl.searchParams.get('sslmode') === 'require') connectionUrl.searchParams.set('sslmode', 'verify-full');
  if (!pool) {
    pool = new Pool({
      connectionString: connectionUrl.toString(),
      enableChannelBinding: true,
      max: 5,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 10000,
    });
    pool.on('error', () => console.error('La conexión PostgreSQL se ha interrumpido.'));
  }
  return pool;
}

export function currentDatabase(): DatabaseSchema {
  const state = context.getStore();
  if (!state) throw new Error('Acceso a datos fuera de una transacción.');
  return state.db;
}

export function stageDatabase(db: DatabaseSchema): void {
  const state = context.getStore();
  if (!state) throw new Error('Escritura fuera de una transacción.');
  state.db = db;
  state.dirty = true;
}

async function readDatabase(client: PoolClient): Promise<DatabaseSchema> {
  const db = {} as DatabaseSchema;
  for (const table of tables) {
    const orderColumn = table === 'visits' ? 'registeredAt' : 'createdAt';
    const result = await client.query(`SELECT coalesce(json_agg(t ORDER BY t."${orderColumn}", t.id), '[]') AS records FROM mvp.${table} t`);
    (db[table] as unknown[]) = result.rows[0].records;
  }
  const settings = await client.query('SELECT to_jsonb(s) - \'id\' AS settings FROM mvp.settings s WHERE id = 1');
  if (!settings.rows[0]) throw new Error('Ejecuta npm run db:setup para inicializar PostgreSQL.');
  db.settings = settings.rows[0].settings;
  return db;
}

async function persistDatabase(client: PoolClient, db: DatabaseSchema, before: DatabaseSchema) {
  // Remove missing records in dependency order; all operations stay in one transaction.
  for (const table of [...tables].reverse()) {
    await client.query(`DELETE FROM mvp.${table} WHERE NOT (id = ANY($1::text[]))`, [db[table].map(row => row.id)]);
  }
  for (const table of tables) {
    const previous = new Map(before[table].map(row => [row.id, JSON.stringify(row)]));
    const changed = db[table].filter(row => previous.get(row.id) !== JSON.stringify(row));
    if (!changed.length) continue;
    // Field names come from fixed application records, never from request SQL.
    const allowed = await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', ['mvp', table]);
    const valid = new Set(allowed.rows.map(row => row.column_name));
    const columns = [...valid].map(name => '"' + name + '"');
    if (changed.some(row => Object.keys(row).some(name => !valid.has(name)))) throw new Error('Respaldo incompatible con el esquema.');
    const updates = columns.filter(name => name !== '"id"').map(name => `${name} = EXCLUDED.${name}`);
    await client.query(`INSERT INTO mvp.${table} (${columns.join(',')}) SELECT ${columns.join(',')} FROM jsonb_populate_recordset(NULL::mvp.${table}, $1::jsonb) ON CONFLICT (id) DO UPDATE SET ${updates.join(',')}`, [JSON.stringify(changed)]);
  }
  await client.query(`UPDATE mvp.settings SET
    "ministryName" = s."ministryName", subtitle = s.subtitle, timezone = s.timezone,
    "customLogoDataUrl" = s."customLogoDataUrl", "adminDateOverridePin" = s."adminDateOverridePin",
    "adminAllowedModules" = s."adminAllowedModules", "registradorAllowedModules" = s."registradorAllowedModules"
    FROM jsonb_populate_record(NULL::mvp.settings, $1::jsonb) s WHERE mvp.settings.id = 1`, [JSON.stringify(db.settings)]);
}

// Keep the existing synchronous domain logic scoped to an isolated request snapshot.
// Writers across all app instances serialize before reading, avoiding lost updates.
export function withDatabase(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    let client: PoolClient | undefined;
    try {
      client = await getPool().connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query("SET LOCAL statement_timeout = '20s'");
      const readOnly = req.method === 'GET';
      await client.query(readOnly
        ? 'SELECT pg_advisory_xact_lock_shared(7152026)'
        : 'SELECT pg_advisory_xact_lock(7152026)');
      const db = await readDatabase(client);
      const before = structuredClone(db);
      const state: State = { db, dirty: false };
      const response = await context.run(state, () => handler(req));
      if (response.status >= 400) {
        await client.query('ROLLBACK');
      } else {
        if (state.dirty) {
          if (readOnly) throw new Error('No se permiten escrituras en solicitudes GET.');
          await persistDatabase(client, state.db, before);
        }
        await client.query('COMMIT');
      }
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      // Never log connection strings, SQL parameters or visitor records.
      console.error('No se pudo completar la transacción PostgreSQL.');
      return NextResponse.json({ error: 'No se pudo guardar o consultar la información. Inténtalo nuevamente.' }, { status: 503 });
    } finally {
      client?.release();
    }
  };
}
