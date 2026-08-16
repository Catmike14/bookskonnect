import { TaxCategory } from '../types';

export type FilingFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type QuarterlyDueRule = 'offsetDays' | 'lastDayOfNextMonth';

export interface BirFilingRule {
  /** Must match a value in COMMON_TAX_TYPES (types.ts) -- this is how a
   * client's applicableTaxes selections map to a filing schedule. A single
   * taxType can have MULTIPLE rules (e.g. expanded withholding has a
   * monthly remittance, a quarterly return, AND an annual alphalist --
   * three real, independent filing obligations under one tax type). */
  taxType: string;
  formCode: string;
  name: string;
  category: TaxCategory;
  frequency: FilingFrequency;
  /** MONTHLY only: day of the month *following* the period month that the
   * filing is due on (e.g. 10 = due the 10th of next month). */
  monthlyDueDay?: number;
  /** MONTHLY only: overrides monthlyDueDay specifically for the December
   * period (1601-C's December remittance is due Jan 15, not the usual
   * 10th -- a well-known year-end exception). */
  monthlyDecemberDueDay?: number;
  /** MONTHLY only: skip generating a deadline for the 3rd month of each
   * quarter. Used for 0619-E: taxes withheld in a quarter's first two
   * months are remitted monthly via 0619-E, but the third month's amount
   * is folded into the quarterly 1601-EQ instead of a separate 0619-E. */
  monthlySkipThirdMonthOfQuarter?: boolean;
  /** QUARTERLY only: which due-date formula applies.
   * 'offsetDays' = a fixed number of days after the quarter closes (VAT,
   * percentage tax, 1702Q -- all a simple day-count from quarter-end).
   * 'lastDayOfNextMonth' = the last calendar day of the month immediately
   * following the quarter (1601-EQ, 1601-FQ) -- NOT a fixed day-count,
   * since "next month" is sometimes 30 days long and sometimes 31. */
  quarterlyDueRule?: QuarterlyDueRule;
  /** QUARTERLY + 'offsetDays' only: days after quarter-close the filing is due. */
  quarterlyOffsetDays?: number;
  /** QUARTERLY only: skip the Q4 (Oct-Dec) occurrence. Used for 1702Q,
   * which only covers the first three quarters -- Q4 is folded into the
   * annual 1702 return instead of getting its own quarterly filing. */
  quarterlySkipQ4?: boolean;
  /** ANNUAL only: fixed month (1-12) and day of month the filing is due
   * every year. */
  annualDueMonth?: number;
  annualDueDay?: number;
}

/**
 * Statutory BIR deadlines, verified against the Ease of Paying Taxes Act
 * (RA 11976, effective Jan 2024) and current guidance rather than assumed
 * from older pre-EOPT material. Two corrections from an earlier version of
 * this file, worth calling out because they'd have generated genuinely
 * wrong dates:
 *   - 1601-EQ and 1601-FQ are due the LAST DAY of the month following the
 *     quarter (Apr 30 / Jul 31 / Oct 31 / Jan 31) -- not a flat "+30 days",
 *     which is wrong for 3 of the 4 quarters (July and October both have
 *     31-day "next months", not 30).
 *   - 0619-E (the monthly expanded withholding remittance) only applies to
 *     a quarter's first two months; the third month is covered by the
 *     quarterly 1601-EQ instead, not a third 0619-E filing.
 * "Annual Registration Fee (Form 0605)" has been removed entirely: the
 * PHP 500 ARF was abolished under EOPT effective January 22, 2024, and is
 * no longer collected from most taxpayers.
 *
 * These are still long-standing statutory rules, not a live feed of BIR
 * issuances -- revenue regulations get amended, filer-type extensions
 * (eFPS group schedules, RMC-granted extensions) exist, and a client's
 * actual fiscal year may not be the calendar year. Anything generated from
 * this calendar is a starting point for the team to verify, not a filing
 * instruction.
 */
export const BIR_FILING_CALENDAR: BirFilingRule[] = [
  {
    taxType: 'VAT (Form 2550Q)',
    formCode: '2550Q',
    name: 'VAT Quarterly Return',
    category: 'VAT 2550Q',
    frequency: 'QUARTERLY',
    quarterlyDueRule: 'offsetDays',
    quarterlyOffsetDays: 25,
  },
  {
    taxType: 'Percentage Tax (Form 2551Q)',
    formCode: '2551Q',
    name: 'Percentage Tax Quarterly Return',
    category: 'Percentage Tax 2551Q',
    frequency: 'QUARTERLY',
    quarterlyDueRule: 'offsetDays',
    quarterlyOffsetDays: 25,
  },
  {
    taxType: 'Compensation Withholding (Form 1601-C)',
    formCode: '1601-C',
    name: 'Withholding Tax on Compensation (Monthly Remittance)',
    category: 'Withholding Tax 1601-C',
    frequency: 'MONTHLY',
    monthlyDueDay: 10,
    monthlyDecemberDueDay: 15,
  },
  {
    taxType: 'Compensation Withholding (Form 1601-C)',
    formCode: '1604-C',
    name: 'Annual Alphalist of Employees (Compensation Withholding)',
    category: 'Withholding Tax 1601-C',
    frequency: 'ANNUAL',
    annualDueMonth: 1,
    annualDueDay: 31,
  },
  {
    taxType: 'Expanded Withholding (Form 0619-E / 1601-EQ)',
    formCode: '0619-E',
    name: 'Expanded Withholding Tax (Monthly Remittance)',
    category: 'Expanded Withholding 0619-E',
    frequency: 'MONTHLY',
    monthlyDueDay: 10,
    monthlySkipThirdMonthOfQuarter: true,
  },
  {
    taxType: 'Expanded Withholding (Form 0619-E / 1601-EQ)',
    formCode: '1601-EQ',
    name: 'Expanded Withholding Tax Quarterly Return (with QAP)',
    category: 'Expanded Withholding 0619-E',
    frequency: 'QUARTERLY',
    quarterlyDueRule: 'lastDayOfNextMonth',
  },
  {
    taxType: 'Expanded Withholding (Form 0619-E / 1601-EQ)',
    formCode: '1604-E',
    name: 'Annual Alphalist of Payees (Expanded Withholding)',
    category: 'Expanded Withholding 0619-E',
    frequency: 'ANNUAL',
    annualDueMonth: 3,
    annualDueDay: 1,
  },
  {
    taxType: 'Final Withholding Tax (Form 1601-FQ)',
    formCode: '1601-FQ',
    name: 'Final Withholding Tax Quarterly Return',
    category: 'Final Withholding 1601-FQ',
    frequency: 'QUARTERLY',
    quarterlyDueRule: 'lastDayOfNextMonth',
  },
  {
    taxType: 'Corporate Income Tax (Form 1702-RT/EX)',
    formCode: '1702Q',
    name: 'Quarterly Income Tax Return',
    category: 'Annual ITR 1702',
    frequency: 'QUARTERLY',
    quarterlyDueRule: 'offsetDays',
    quarterlyOffsetDays: 60,
    quarterlySkipQ4: true,
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
];

/**
 * These tax types are real and common, but their actual due dates vary too
 * much to safely auto-generate a single date for every client -- Local
 * Business Tax deadlines are set per LGU, and SSS/PhilHealth/Pag-IBIG
 * remittance schedules are staggered by the last digit of the employer
 * number. Surfacing a made-up fixed date for these would be actively
 * misleading, so they're deliberately left out of BIR_FILING_CALENDAR and
 * should be added to the compliance calendar manually instead.
 *
 * Not yet modeled despite having a fixed rule (a known gap, not a decision
 * to exclude): individual quarterly income tax (1701Q) has an irregular
 * Q3 due date (a fixed mid-November date rather than the usual "60 days
 * after quarter-close" pattern) that needs its own verified rule before
 * it's safe to add here.
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
    for (let offset = -1; offset <= monthsAhead + 1; offset++) {
      const periodDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);

      if (rule.monthlySkipThirdMonthOfQuarter && periodDate.getMonth() % 3 === 2) {
        continue; // this period's obligation is covered by the quarterly return instead
      }

      const isDecember = periodDate.getMonth() === 11;
      const dueDay = (isDecember && rule.monthlyDecemberDueDay) ? rule.monthlyDecemberDueDay : (rule.monthlyDueDay ?? 10);
      const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, dueDay);

      if (dueDate >= windowStart && dueDate <= windowEnd) {
        results.push({
          periodLabel: periodDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
          dueDate: toIsoDate(dueDate),
        });
      }
    }
  } else if (rule.frequency === 'QUARTERLY') {
    const dueRule = rule.quarterlyDueRule ?? 'offsetDays';
    for (let yearOffset = -1; yearOffset <= 1; yearOffset++) {
      const year = today.getFullYear() + yearOffset;
      for (const qEndMonthIdx of QUARTER_END_MONTH_INDEXES) {
        if (rule.quarterlySkipQ4 && qEndMonthIdx === 11) continue; // no Q4 return -- covered by the annual filing

        const quarterEnd = lastDayOfMonth(year, qEndMonthIdx);
        const dueDate = dueRule === 'lastDayOfNextMonth'
          ? lastDayOfMonth(quarterEnd.getFullYear(), quarterEnd.getMonth() + 1)
          : new Date(quarterEnd.getFullYear(), quarterEnd.getMonth(), quarterEnd.getDate() + (rule.quarterlyOffsetDays ?? 25));

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

/** A tax type can map to more than one concrete filing rule (see
 * BirFilingRule's doc comment) -- callers must handle all of them, not just
 * the first match. */
export function findRulesForTaxType(taxType: string): BirFilingRule[] {
  return BIR_FILING_CALENDAR.filter((r) => r.taxType === taxType);
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
      const rules = findRulesForTaxType(taxType);
      if (rules.length === 0) continue; // no auto-schedule for this tax type (e.g. LGU permits, SSS)

      for (const rule of rules) {
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
  }

  return results;
}
