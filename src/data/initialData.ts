import { User, Task, Client, TaxDeadline } from '../types';

export const TEAM_USERS: User[] = [
  {
    id: 1,
    name: 'Michael Catorce',
    role: 'Manager',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    email: 'michael.catorce@bookskonnect.com'
  },
  {
    id: 2,
    name: 'Sarah Staff',
    role: 'Staff Auditor',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    email: 'sarah.staff@bookskonnect.com'
  },
  {
    id: 3,
    name: 'Maria Santos',
    role: 'Senior CPA',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    email: 'maria.santos@bookskonnect.com'
  },
  {
    id: 4,
    name: 'Jon Reyes',
    role: 'Tax Specialist',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150',
    email: 'jon.reyes@bookskonnect.com'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 1,
    name: 'Kingsway Inspection Services',
    industry: 'Engineering & Quality Assurance',
    tin: '008-912-341-000',
    activeEngagementsCount: 4,
    managerInCharge: 'Michael Catorce',
    healthStatus: 'Good',
    contactEmail: 'accounting@kingswayinspection.com',
    contactPhone: '+63 2 8812 4490',
    notes: 'Quarterly VAT and expanded withholding client. Always submits sales journals on time.'
  },
  {
    id: 2,
    name: 'Fivesome Tech Solutions',
    industry: 'Software & Cloud Consultancy',
    tin: '009-441-209-000',
    activeEngagementsCount: 3,
    managerInCharge: 'Maria Santos',
    healthStatus: 'Needs Documents',
    contactEmail: 'admin@fivesometech.io',
    contactPhone: '+63 2 8901 2233',
    notes: 'Pending barangay clearance and LGU Mayor Permit renewal documents.'
  },
  {
    id: 3,
    name: 'Acme Retail Outlets Inc.',
    industry: 'Consumer Goods & Retail',
    tin: '004-112-990-000',
    activeEngagementsCount: 5,
    managerInCharge: 'Jon Reyes',
    healthStatus: 'At Risk',
    contactEmail: 'finance@acmeretail.com',
    contactPhone: '+63 2 8334 1100',
    notes: 'Annual ITR 1702 reconciliation underway. Discrepancy noted between POS sales log and BIR eFPS deposits.'
  },
  {
    id: 4,
    name: 'Horizon Logistics Corp',
    industry: 'Freight & Supply Chain',
    tin: '007-883-210-000',
    activeEngagementsCount: 2,
    managerInCharge: 'Michael Catorce',
    healthStatus: 'Good',
    contactEmail: 'tax@horizonlogistics.ph',
    contactPhone: '+63 2 8221 7700',
    notes: 'Monthly bookkeeping and payroll tax compliance.'
  }
];

export const INITIAL_DEADLINES: TaxDeadline[] = [
  {
    id: 1,
    formCode: 'BIR 2550Q',
    name: 'Quarterly Value-Added Tax Return (Q2)',
    deadlineDate: '2026-08-25',
    description: 'Cumulative Q2 sales, input tax credits, and official receipt verification.',
    status: 'Urgent'
  },
  {
    id: 2,
    formCode: 'BIR 1601-C',
    name: 'Monthly Monthly Remittance Return of Income Taxes Withheld on Compensation',
    deadlineDate: '2026-08-20',
    description: 'Payroll withholding tax reconciliation for July payroll cycle.',
    status: 'Upcoming'
  },
  {
    id: 3,
    formCode: 'BIR 0619-E',
    name: 'Monthly Remittance Return of Creditable Income Taxes Withheld (Expanded)',
    deadlineDate: '2026-08-30',
    description: 'Supplier 2307 certificates and expanded withholding tax breakdown.',
    status: 'Upcoming'
  },
  {
    id: 4,
    formCode: 'LGU Renewal',
    name: 'Q3 Local Business Tax Installment',
    deadlineDate: '2026-09-20',
    description: 'LGU City Treasurer assessment payments.',
    status: 'Upcoming'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 101,
    title: 'Q2 Form 2550Q VAT Return Reconciliation',
    clientName: 'Kingsway Inspection Services',
    description: 'Gathering supporting sales invoices and purchase journals before final eFPS submission. Input tax certificates verified against supplier 2307s.',
    status: 'IN_PROGRESS',
    category: 'VAT 2550Q',
    priority: 'HIGH',
    dueDate: '2026-08-24',
    flagged: false,
    flagReason: null,
    creator: TEAM_USERS[0], // Michael Catorce
    assignee: TEAM_USERS[1], // Sarah Staff
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    auditLog: [
      { id: 'a1', timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), user: 'Michael Catorce', action: 'Created task broadcast' },
      { id: 'a2', timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), user: 'Sarah Staff', action: 'Updated status to IN_PROGRESS' }
    ],
    reactions: {
      'acknowledged': ['Maria Santos', 'Jon Reyes'],
      'urgent': []
    },
    comments: [
      {
        id: 201,
        user: TEAM_USERS[1], // Sarah Staff
        content: 'Collected all input VAT official receipts from major sub-contractors. Total input credit verified at ₱142,500.00.',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 202,
        user: TEAM_USERS[2], // Maria Santos
        content: 'Great progress Sarah. Double-check if the machinery capital goods amortization needs BIR Schedule 3 entry.',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
      }
    ],
    attachments: [
      { name: 'Kingsway_Sales_Journal_Q2.xlsx', url: '#', size: '1.2 MB' },
      { name: 'Input_VAT_Summary.pdf', url: '#', size: '480 KB' }
    ]
  },
  {
    id: 102,
    title: 'Annual Business Permit Renewal - LGU Sign-off',
    clientName: 'Fivesome Tech Solutions',
    description: 'Waiting for barangay clearance sign-off and sanitary permit inspection before paying the LGU Treasurer assessment.',
    status: 'OPEN',
    category: 'Business Permit Renewal',
    priority: 'URGENT',
    dueDate: '2026-08-05',
    flagged: true,
    flagReason: 'Barangay clearance delayed due to signatory absence at Barangay Hall until Thursday.',
    flagDate: new Date(Date.now() - 3600000 * 12).toISOString(),
    creator: TEAM_USERS[1], // Sarah Staff
    assignee: TEAM_USERS[3], // Jon Reyes
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    auditLog: [
      { id: 'b1', timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), user: 'Sarah Staff', action: 'Created task broadcast' },
      { id: 'b2', timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), user: 'Sarah Staff', action: 'Flagged roadblock: Barangay clearance delayed' }
    ],
    reactions: {
      'acknowledged': ['Michael Catorce'],
      'urgent': ['Sarah Staff', 'Michael Catorce']
    },
    comments: [
      {
        id: 203,
        user: TEAM_USERS[3], // Jon Reyes
        content: 'I called the LGU Business Permit & Licensing Office. They confirmed we can present an authorization letter and provisional receipt.',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    ]
  },
  {
    id: 103,
    title: 'July Payroll 1601-C Withholding Tax Calculation',
    clientName: 'Acme Retail Outlets Inc.',
    description: 'Computed July 1601-C withholding on compensation across 148 retail employees. Finalizing minimum wage exempt list.',
    status: 'PENDING_REVIEW',
    category: 'Withholding Tax 1601-C',
    priority: 'NORMAL',
    dueDate: '2026-08-20',
    flagged: false,
    flagReason: null,
    creator: TEAM_USERS[3], // Jon Reyes
    assignee: TEAM_USERS[2], // Maria Santos
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    auditLog: [
      { id: 'c1', timestamp: new Date(Date.now() - 3600000 * 30).toISOString(), user: 'Jon Reyes', action: 'Created task' },
      { id: 'c2', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), user: 'Jon Reyes', action: 'Submitted for PENDING_REVIEW' }
    ],
    reactions: {
      'acknowledged': ['Maria Santos'],
      'urgent': []
    },
    comments: []
  },
  {
    id: 104,
    title: 'Monthly Financial Statement Closing - July',
    clientName: 'Horizon Logistics Corp',
    description: 'Bank reconciliation completed. Trial balance balanced against GL accounts. Ready for management presentation.',
    status: 'DONE',
    category: 'Monthly Bookkeeping',
    priority: 'NORMAL',
    dueDate: '2026-08-15',
    flagged: false,
    flagReason: null,
    creator: TEAM_USERS[2], // Maria Santos
    assignee: TEAM_USERS[0], // Michael Catorce
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    auditLog: [
      { id: 'd1', timestamp: new Date(Date.now() - 3600000 * 72).toISOString(), user: 'Maria Santos', action: 'Created task' },
      { id: 'd2', timestamp: new Date(Date.now() - 3600000 * 10).toISOString(), user: 'Michael Catorce', action: 'Marked as DONE' }
    ],
    reactions: {
      'acknowledged': ['Sarah Staff', 'Jon Reyes', 'Michael Catorce'],
      'urgent': []
    },
    comments: [
      {
        id: 204,
        user: TEAM_USERS[0],
        content: 'Management financial report delivered to Horizon CEO. Excellent job closing on schedule!',
        createdAt: new Date(Date.now() - 3600000 * 10).toISOString()
      }
    ]
  }
];
