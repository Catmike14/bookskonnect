export type Role = 'System Administrator' | 'Manager' | 'Senior CPA' | 'Staff Auditor' | 'Tax Specialist' | 'Accounting Associate' | 'Admin Officer' | 'Bookkeeper';

export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: number;
  name: string;
  role: Role;
  avatar: string;
  email: string;
  status?: UserStatus;
  createdAt?: string;
  adminKey?: string;
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
  | 'General Advisory'
  | (string & {});

export const DEFAULT_TAX_CATEGORIES: string[] = [
  'VAT 2550Q',
  'Percentage Tax 2551Q',
  'Withholding Tax 1601-C',
  'Annual ITR 1702',
  'Expanded Withholding 0619-E',
  'Monthly Bookkeeping',
  'Payroll & SSS/HDMF',
  'Financial Audit',
  'Business Permit Renewal',
  'General Advisory'
];

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
  // Extended Tax & Client Corporate Profile Fields
  rdoCode?: string;
  secDtiNumber?: string;
  taxRegistrationType?: string;
  applicableTaxes?: string[];
  contactPerson?: string;
  registeredAddress?: string;
  accountingMethod?: string;
  fiscalYearEnd?: string;
  subscribedServices?: string[];
}

export const COMMON_TAX_TYPES = [
  'VAT (Form 2550Q)',
  'Percentage Tax (Form 2551Q)',
  'Compensation Withholding (Form 1601-C)',
  'Expanded Withholding (Form 0619-E / 1601-EQ)',
  'Final Withholding Tax (Form 1601-FQ)',
  'Corporate Income Tax (Form 1702-RT/EX)',
  'Individual Income Tax (Form 1701)',
  'Annual Registration Fee (Form 0605)',
  'Local Business Tax (LGU Permits)',
  'SSS / PhilHealth / Pag-IBIG Contributions'
];

export const TAX_REGISTRATION_TYPES = [
  '-- Select Type --',
  'Corporation',
  'One Person Corporation (OPC)',
  'Sole Proprietorship',
  'Partnership',
  'VAT Registered (12%)',
  'Non-VAT / Percentage Tax (3%)',
  'PEZA / BOI Incentivized (5% GIT)',
  'Tax Exempt Entity',
  'Zero-Rated Exporter',
  'Sole Proprietorship (8% Flat Rate)',
  'General Professional Partnership (GPP)'
];

export const COMMON_RDO_CODES = [
  'RDO 044 - Taguig / Pateros',
  'RDO 050 - South Makati',
  'RDO 047 - East Pasig',
  'RDO 039 - South Quezon City',
  'RDO 038 - North Quezon City',
  'RDO 043 - Pasay City',
  'RDO 051 - Pasig City',
  'RDO 053B - Muntinlupa City',
  'RDO 028 - Baguio City',
  'RDO 080 - Mandaue City, Cebu',
  'RDO 113 - West Davao City',
  'RDO 126 - Large Taxpayers District Office (LTDO)'
];

export const COMMON_RETAINER_SERVICES = [
  'Bookkeeping & General Ledger',
  'BIR Tax Filing & Compliance',
  'Payroll Processing & Slips',
  'Audited Financial Statements (AFS)',
  'Expanded Withholding Tax Filings',
  'Annual Income Tax Preparation',
  'Government Benefits (SSS/HDMF/PhilHealth)',
  'SEC Annual Reportorial Filings',
  'Business Permit & LGU Renewal',
  'CPA Tax Audit Representation'
];

export interface TaxDeadline {
  id: number;
  formCode: string;
  name: string;
  deadlineDate: string;
  description: string;
  status: 'Upcoming' | 'Urgent' | 'Completed';
}
