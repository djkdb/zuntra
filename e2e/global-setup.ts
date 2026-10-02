import { config } from "dotenv";
import pg from "pg";

/** Start every E2E run from an empty test database. */
export default async function globalSetup() {
  const env = config({ path: ".env.test", quiet: true }).parsed ?? {};
  if (!env.DATABASE_URL?.includes("test")) throw new Error("E2E must run against a *test* database.");
  const client = new pg.Client({ connectionString: env.DATABASE_URL.replace(/\?.*$/, "") });
  await client.connect();
  try {
    await client.query(`
      DO $$ DECLARE r record; BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
          EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;`);
  } catch {
    // Tables do not exist yet on a fresh database; the web server's migrate step creates them.
  } finally {
    await client.end();
  }
}
