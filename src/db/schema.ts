import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatar: text('avatar').notNull(),
  email: text('email').notNull(),
  status: text('status').default('APPROVED').notNull(),
  // bcrypt hash. Nullable only to tolerate pre-existing rows created before
  // this column existed; the app layer always requires it for new signups
  // and rejects login for accounts that don't have one.
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Server-side session tokens. A session token is an opaque random value
// handed to the browser as an httpOnly cookie; the token itself carries no
// identity or role information, so it can't be forged or edited client-side.
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Custom task/tax categories, previously kept in a plain in-memory array on
// the server (lost on every restart/redeploy). Persisted properly now.
export const taskCategories = pgTable('task_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry').notNull(),
  tin: text('tin').notNull(),
  activeEngagementsCount: integer('active_engagements_count').default(0).notNull(),
  managerInCharge: text('manager_in_charge').notNull(),
  healthStatus: text('health_status').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),
  notes: text('notes').notNull(),
  rdoCode: text('rdo_code'),
  entityType: text('entity_type'),
  secDtiNumber: text('sec_dti_number'),
  taxRegistrationType: text('tax_registration_type'),
  applicableTaxesJson: jsonb('applicable_taxes_json').default([]),
  contactPerson: text('contact_person'),
  registeredAddress: text('registered_address'),
  accountingMethod: text('accounting_method'),
  fiscalYearEnd: text('fiscal_year_end'),
  subscribedServicesJson: jsonb('subscribed_services_json').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  clientName: text('client_name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull(),
  dueDate: text('due_date'),
  flagged: boolean('flagged').default(false).notNull(),
  flagReason: text('flag_reason'),
  flagDate: text('flag_date'),
  creatorJson: jsonb('creator_json').notNull(),
  assigneeJson: jsonb('assignee_json'),
  commentsJson: jsonb('comments_json').default([]).notNull(),
  reactionsJson: jsonb('reactions_json').default({}).notNull(),
  auditLogJson: jsonb('audit_log_json').default([]).notNull(),
  attachmentsJson: jsonb('attachments_json').default([]),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const taxDeadlines = pgTable('tax_deadlines', {
  id: serial('id').primaryKey(),
  formCode: text('form_code').notNull(),
  name: text('name').notNull(),
  deadlineDate: text('deadline_date').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
});
