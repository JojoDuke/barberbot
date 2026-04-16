/**
 * One-time (or ops) wipe of ALL Mastra chat threads + messages in LibSQL.
 * Use after fixing duplicate-history bugs so no user needs to type !clear.
 *
 * Must match the DB URL in src/mastra/storage.ts (default: file:mastra.db next to process cwd).
 *
 * Run from repo root:
 *   FORCE_CLEAR=1 pnpm exec tsx src/scripts/clear-all-mastra-conversations.ts
 *   # or: pnpm mastra:clear-all
 *
 * Production: run on the machine that owns mastra.db (same cwd / path as the WhatsApp process).
 * Set MASTRA_LIBSQL_URL if you use a non-default file path or Turso URL.
 */
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const TABLES = {
  messages: 'mastra_messages',
  threads: 'mastra_threads',
} as const;

async function main() {
  const confirmed =
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.FORCE_CLEAR === '1';

  if (!confirmed) {
    console.error(
      'Refusing to delete all conversations. Re-run with FORCE_CLEAR=1 or pass --yes'
    );
    process.exit(1);
  }

  const url =
    process.env.MASTRA_LIBSQL_URL ||
    process.env.LIBSQL_URL ||
    'file:mastra.db';

  console.log(`Connecting to LibSQL: ${url.replace(/:[^:@/]+@/, ':****@')}`);

  const client = createClient({ url });

  try {
    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN (?, ?)`,
      [TABLES.messages, TABLES.threads]
    );
    const names = new Set(
      (tables.rows as { name: string }[]).map((r) => r.name)
    );

    if (!names.has(TABLES.messages) || !names.has(TABLES.threads)) {
      console.warn(
        'Mastra tables not found in this database (wrong MASTRA_LIBSQL_URL, or DB not initialized yet). Nothing to delete.'
      );
      console.warn(`Expected tables: ${TABLES.messages}, ${TABLES.threads}`);
      return;
    }

    const msgRes = await client.execute(`DELETE FROM ${TABLES.messages}`);
    const thrRes = await client.execute(`DELETE FROM ${TABLES.threads}`);

    console.log(
      `Deleted rows: ${TABLES.messages}=${msgRes.rowsAffected ?? '?'}, ${TABLES.threads}=${thrRes.rowsAffected ?? '?'}`
    );
    console.log('✅ All Mastra conversation threads cleared.');
  } finally {
    client.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
