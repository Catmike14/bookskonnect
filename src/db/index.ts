import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSqlClient() {
  if (!sqlClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not configured.");
    }
    // Enable SSL for external PostgreSQL services (Render, Neon, Supabase, etc.) if needed or in production
    const isProd = process.env.NODE_ENV === 'production' || 
                   process.env.DATABASE_URL?.includes('render.com') || 
                   process.env.DATABASE_URL?.includes('sslmode=require');
    
    sqlClient = postgres(connectionString, {
      ssl: isProd ? { rejectUnauthorized: false } : undefined,
      connect_timeout: 5,
      max: 5,
      idle_timeout: 10,
      onnotice: () => {}
    });
  }
  return sqlClient;
}

export function getDb() {
  if (!dbInstance) {
    const client = getSqlClient();
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}

export async function ensureTablesExist() {
  const sql = getSqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT DEFAULT 'APPROVED' NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED';
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      tin TEXT NOT NULL,
      active_engagements_count INTEGER DEFAULT 0 NOT NULL,
      manager_in_charge TEXT NOT NULL,
      health_status TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      notes TEXT NOT NULL,
      rdo_code TEXT,
      entity_type TEXT,
      sec_dti_number TEXT,
      tax_registration_type TEXT,
      applicable_taxes_json JSONB DEFAULT '[]'::jsonb,
      contact_person TEXT,
      registered_address TEXT,
      accounting_method TEXT,
      fiscal_year_end TEXT,
      subscribed_services_json JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS rdo_code TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS entity_type TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS sec_dti_number TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_registration_type TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS applicable_taxes_json JSONB DEFAULT '[]'::jsonb;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS registered_address TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS accounting_method TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS fiscal_year_end TEXT;
  `;
  await sql`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscribed_services_json JSONB DEFAULT '[]'::jsonb;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      flagged BOOLEAN DEFAULT FALSE NOT NULL,
      flag_reason TEXT,
      flag_date TEXT,
      creator_json JSONB NOT NULL,
      assignee_json JSONB,
      comments_json JSONB DEFAULT '[]'::jsonb NOT NULL,
      reactions_json JSONB DEFAULT '{}'::jsonb NOT NULL,
      audit_log_json JSONB DEFAULT '[]'::jsonb NOT NULL,
      attachments_json JSONB DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS tax_deadlines (
      id SERIAL PRIMARY KEY,
      form_code TEXT NOT NULL,
      name TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `;
}

