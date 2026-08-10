import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  avatar: text('avatar').notNull(),
  email: text('email').notNull(),
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
