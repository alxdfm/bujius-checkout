import { defineConfig } from 'drizzle-kit';

// Next loads `.env.local` itself; drizzle-kit does not.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No file: DATABASE_URL must already be in the environment.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
