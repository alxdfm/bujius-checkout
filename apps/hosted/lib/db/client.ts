import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { bujiusDb?: Db };

/** One lazily created connection per lambda; Neon's pooler needs prepared statements off. */
export function getDb(): Db {
  if (globalForDb.bujiusDb) return globalForDb.bujiusDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing env var DATABASE_URL');
  const client = postgres(url, { max: 1, prepare: false, idle_timeout: 20 });
  globalForDb.bujiusDb = drizzle(client, { schema });
  return globalForDb.bujiusDb;
}
