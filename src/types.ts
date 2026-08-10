export type Role = 'System Administrator' | 'Manager' | 'Senior CPA' | 'Staff Auditor' | 'Tax Specialist' | 'Bookkeeper';

export interface User {
  id: number;
  name: string;
  role: Role;
  avatar: string;
  email: string;
}

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'DONE';

export type TaxCategory = 
  | 'VAT 2550Q' 
  | 'Percentage Tax 2551Q' 
  | 'Withholding Tax 1601-C' 
  | 'Annual ITR 1702' 
  | 'Expanded Withholding 0619-E' 
  | 'Monthly Bookkeeping' 
  | 'Payroll & SSS/HDMF' 
  | 'Financial Audit' 
  | 'Business Permit Renewal' 
  | 'General Advisory';

export type Priority = 'URGENT' | 'HIGH' | 'NORMAL';

export interface Comment {
  id: number;
  user: User;
  content: string;
  createdAt: string;
  isAiGenerated?: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface Task {
  id: number;
  title: string;
  clientName: string;
  description: string;
  status: TaskStatus;
  category: TaxCategory;
  priority: Priority;
  dueDate?: string;
  flagged: boolean;
  flagReason?: string | null;
  flagDate?: string | null;
  creator: User;
  assignee?: User;
  comments: Comment[];
  reactions: Record<string, string[]>; // { 'acknowledged': ['Michael Catorce', 'Sarah Staff'], 'urgent': [] }
  createdAt: string;
  updatedAt: string;
  auditLog: AuditEntry[];
  attachments?: { name: string; url: string; size?: string }[];
}

export interface Client {
  id: number;
  name: string;
  industry: string;
  tin: string;
  activeEngagementsCount: number;
  managerInCharge: string;
  healthStatus: 'Good' | 'At Risk' | 'Needs Documents';
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

export interface TaxDeadline {
  id: number;
  formCode: string;
  name: string;
  deadlineDate: string;
  description: string;
  status: 'Upcoming' | 'Urgent' | 'Completed';
}
