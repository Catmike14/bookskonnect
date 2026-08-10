import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not configured.");
    }
    const client = postgres(connectionString);
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
