import { TaxCategory } from '../types';

export type FilingFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface BirFilingRule {
  /** Must match a value in COMMON_TAX_TYPES (types.ts) -- this is how a
   * client's applicableTaxes selections map to a filing schedule. */
  taxType: string;
  formCode: string;
  name: string;
  category: TaxCategory;
  frequency: FilingFrequency;
  /** MONTHLY only: day of the month *following* the period month that the
   * filing is due on (e.g. 10 = due the 10th of next month). */
  monthlyDueDay?: number;
  /** QUARTERLY only: days after the close of the taxable quarter (Mar 31,
   * Jun 30, Sep 30, Dec 31) that the filing is due. */
  quarterlyOffsetDays?: number;
  /** ANNUAL only: fixed month (1-12) and day of month the filing is due
   * every year. */
  annualDueMonth?: number;
  annualDueDay?: number;
}

/**
 * Statutory BIR deadlines under the NIRC, as commonly cited (VAT/percentage
 * tax: 25 days after the taxable quarter; withholding remittances: 10th of
 * the following month; annual income tax: April 15). These are long-standing
 * rules, but BIR revenue regulations do get amended, filer-type extensions
 * (e.g. eFPS group schedules) exist, and a client's actual fiscal year may
 * not be the calendar year. Anything generated from this calendar should be
 * treated as a starting point for the team to verify, not filed blind.
 */
export const BIR_FILING_CALENDAR: BirFilingRule[] = [
  {
    taxType: 'VAT (Form 2550Q)',
    formCode: '2550Q',
    name: 'VAT Quarterly Return',
    category: 'VAT 2550Q',
    frequency: 'QUARTERLY',
    quarterlyOffsetDays: 25,
  },
  {
    taxType: 'Percentage Tax (Form 2551Q)',
    formCode: '2551Q',
    name: 'Percentage Tax Quarterly Return',
    category: 'Percentage Tax 2551Q',
    frequency: 'QUARTERLY',
    quarterlyOffsetDays: 25,
  },
  {
    taxType: 'Compensation Withholding (Form 1601-C)',
    formCode: '1601-C',
    name: 'Withholding Tax on Compensation (Monthly Remittance)',
    category: 'Withholding Tax 1601-C',
    frequency: 'MONTHLY',
    monthlyDueDay: 10,
  },
  {
    taxType: 'Expanded Withholding (Form 0619-E / 1601-EQ)',
    formCode: '0619-E',
    name: 'Expanded Withholding Tax (Monthly Remittance)',
    category: 'Expanded Withholding 0619-E',
    frequency: 'MONTHLY',
    monthlyDueDay: 10,
  },
  {
    taxType: 'Final Withholding Tax (Form 1601-FQ)',
    formCode: '1601-FQ',
    name: 'Final Withholding Tax Quarterly Return',
    category: 'Final Withholding 1601-FQ',
    frequency: 'QUARTERLY',
    quarterlyOffsetDays: 30,
  },
  {
    taxType: 'Corporate Income Tax (Form 1702-RT/EX)',
    formCode: '1702',
    name: 'Annual Corporate Income Tax Return',
    category: 'Annual ITR 1702',
    frequency: 'ANNUAL',
    annualDueMonth: 4,
    annualDueDay: 15,
  },
  {
    taxType: 'Individual Income Tax (Form 1701)',
    formCode: '1701',
    name: 'Annual Individual Income Tax Return',
    category: 'Individual Income Tax 1701',
    frequency: 'ANNUAL',
    annualDueMonth: 4,
    annualDueDay: 15,
  },
  {
    taxType: 'Annual Registration Fee (Form 0605)',
    formCode: '0605',
    name: 'Annual Registration Fee',
    category: 'Annual Registration 0605',
    frequency: 'ANNUAL',
    annualDueMonth: 1,
    annualDueDay: 31,
  },
];

/**
 * These tax types are real and common, but their actual due dates vary too
 * much to safely auto-generate a single date for every client -- Local
 * Business Tax deadlines are set per LGU, and SSS/PhilHealth/Pag-IBIG
 * remittance schedules are staggered by the last digit of the employer
 * number. Surfacing a made-up fixed date for these would be actively
 * misleading, so they're deliberately left out of BIR_FILING_CALENDAR and
 * should be added to the compliance calendar manually instead.
 */
export const MANUAL_ONLY_TAX_TYPES = [
  'Local Business Tax (LGU Permits)',
  'SSS / PhilHealth / Pag-IBIG Contributions',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function lastDayOfMonth(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export interface ComputedDeadline {
  periodLabel: string; // e.g. "August 2026", "Q3 2026", "2026"
  dueDate: string; // ISO yyyy-mm-dd
}

const QUARTER_END_MONTH_INDEXES = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (0-indexed)

/**
 * Every due date for a filing rule that falls within
 * [today, today + monthsAhead months]. One entry per period: each month for
 * MONTHLY, each calendar quarter for QUARTERLY, each year's occurrence for
 * ANNUAL. Deliberately looks slightly before `today` too (covers a period
 * that just closed but whose due date hasn't passed yet) and slightly after
 * the window (safety margin), then filters to the exact window.
 */
export function computeUpcomingDueDates(
  rule: BirFilingRule,
  monthsAhead: number,
  today: Date = new Date()
): ComputedDeadline[] {
  const results: ComputedDeadline[] = [];
  const windowStart = startOfDay(today);
  const windowEnd = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate());

  if (rule.frequency === 'MONTHLY') {
    const dueDay = rule.monthlyDueDay ?? 10;
    for (let offset = -1; offset <= monthsAhead + 1; offset++) {
      const periodDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, dueDay);
      if (dueDate >= windowStart && dueDate <= windowEnd) {
        results.push({
          periodLabel: periodDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          dueDate: toIsoDate(dueDate),
        });
      }
    }
  } else if (rule.frequency === 'QUARTERLY') {
    const offsetDays = rule.quarterlyOffsetDays ?? 25;
    for (let yearOffset = -1; yearOffset <= 1; yearOffset++) {
      const year = today.getFullYear() + yearOffset;
      for (const qEndMonthIdx of QUARTER_END_MONTH_INDEXES) {
        const quarterEnd = lastDayOfMonth(year, qEndMonthIdx);
        const dueDate = new Date(quarterEnd.getFullYear(), quarterEnd.getMonth(), quarterEnd.getDate() + offsetDays);
        if (dueDate >= windowStart && dueDate <= windowEnd) {
          const quarterNumber = Math.floor(qEndMonthIdx / 3) + 1;
          results.push({
            periodLabel: `Q${quarterNumber} ${year}`,
            dueDate: toIsoDate(dueDate),
          });
        }
      }
    }
  } else if (rule.frequency === 'ANNUAL') {
    const month = (rule.annualDueMonth ?? 4) - 1;
    const day = rule.annualDueDay ?? 15;
    for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
      const year = today.getFullYear() + yearOffset;
      const dueDate = new Date(year, month, day);
      if (dueDate >= windowStart && dueDate <= windowEnd) {
        results.push({ periodLabel: `${year}`, dueDate: toIsoDate(dueDate) });
      }
    }
  }

  results.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return results;
}

export function findRuleForTaxType(taxType: string): BirFilingRule | undefined {
  return BIR_FILING_CALENDAR.find((r) => r.taxType === taxType);
}

export interface PlannedGenerationItem {
  clientId: number;
  clientName: string;
  formCode: string;
  name: string;
  deadlineDate: string;
  description: string;
  category: TaxCategory;
  periodLabel: string;
  taxType: string;
  /** Whether a deadline calendar entry still needs to be created for this. */
  needsDeadline: boolean;
  /** Whether an actionable task still needs to be created for this. */
  needsTask: boolean;
}

interface MinimalClient {
  id: number;
  name: string;
  applicableTaxes?: string[] | null;
}
interface ExistingDeadlineRef {
  clientId?: number | null;
  formCode: string;
  deadlineDate: string;
}
interface ExistingTaskRef {
  clientName: string;
  category: string;
  dueDate?: string | null;
}

/**
 * Pure planning function: given a set of clients (with their registered tax
 * types) and what deadlines/tasks already exist, works out exactly what new
 * deadline/task pairs the BIR filing calendar would add over the next
 * `monthsAhead` months -- without creating anything itself. Idempotent by
 * construction: calling this again after the caller has actually created
 * everything it returned will return nothing (or only the parts still
 * missing, if e.g. a deadline was deleted but the matching task wasn't).
 * Kept side-effect-free specifically so it's easy to unit test the
 * generation logic without a database, a server, or React.
 */
export function planDeadlineGeneration(
  clients: MinimalClient[],
  existingDeadlines: ExistingDeadlineRef[],
  existingTasks: ExistingTaskRef[],
  monthsAhead: number = 3,
  today: Date = new Date()
): PlannedGenerationItem[] {
  const results: PlannedGenerationItem[] = [];

  for (const client of clients) {
    for (const taxType of client.applicableTaxes || []) {
      const rule = findRuleForTaxType(taxType);
      if (!rule) continue; // no auto-schedule for this tax type (e.g. LGU permits, SSS)

      const occurrences = computeUpcomingDueDates(rule, monthsAhead, today);
      for (const occurrence of occurrences) {
        const needsDeadline = !existingDeadlines.some(
          (d) => d.clientId === client.id && d.formCode === rule.formCode && d.deadlineDate === occurrence.dueDate
        );
        const needsTask = !existingTasks.some(
          (t) => t.clientName === client.name && t.category === rule.category && t.dueDate === occurrence.dueDate
        );
        if (!needsDeadline && !needsTask) continue; // already fully generated, nothing to do

        results.push({
          clientId: client.id,
          clientName: client.name,
          formCode: rule.formCode,
          name: `${rule.name} — ${client.name}`,
          deadlineDate: occurrence.dueDate,
          description: `Auto-generated from the BIR filing calendar for ${occurrence.periodLabel}. Verify against current BIR/RMC guidance before filing.`,
          category: rule.category,
          periodLabel: occurrence.periodLabel,
          taxType,
          needsDeadline,
          needsTask,
        });
      }
    }
  }

  return results;
}
