import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeUpcomingDueDates, BIR_FILING_CALENDAR, findRulesForTaxType, planDeadlineGeneration } from '../src/utils/birCalendar';

const vatRule = findRulesForTaxType('VAT (Form 2550Q)')[0];
const compWithholdingRules = findRulesForTaxType('Compensation Withholding (Form 1601-C)');
const monthlyCompWithholding = compWithholdingRules.find((r) => r.formCode === '1601-C')!;
const annualCompAlphalist = compWithholdingRules.find((r) => r.formCode === '1604-C')!;
const expandedWithholdingRules = findRulesForTaxType('Expanded Withholding (Form 0619-E / 1601-EQ)');
const monthly0619E = expandedWithholdingRules.find((r) => r.formCode === '0619-E')!;
const quarterly1601EQ = expandedWithholdingRules.find((r) => r.formCode === '1601-EQ')!;
const annual1604E = expandedWithholdingRules.find((r) => r.formCode === '1604-E')!;
const quarterly1601FQ = findRulesForTaxType('Final Withholding Tax (Form 1601-FQ)')[0];
const corpIncomeTaxRules = findRulesForTaxType('Corporate Income Tax (Form 1702-RT/EX)');
const quarterly1702Q = corpIncomeTaxRules.find((r) => r.formCode === '1702Q')!;
const annualCorpItr = corpIncomeTaxRules.find((r) => r.formCode === '1702')!;

test('every filing rule has a category and a valid frequency-specific config', () => {
  for (const rule of BIR_FILING_CALENDAR) {
    assert.ok(rule.category, `${rule.taxType}/${rule.formCode} is missing a category`);
    if (rule.frequency === 'MONTHLY') {
      assert.ok(rule.monthlyDueDay, `${rule.formCode} missing monthlyDueDay`);
    }
    if (rule.frequency === 'QUARTERLY') {
      const dueRule = rule.quarterlyDueRule ?? 'offsetDays';
      if (dueRule === 'offsetDays') {
        assert.ok(rule.quarterlyOffsetDays, `${rule.formCode} uses offsetDays but is missing quarterlyOffsetDays`);
      }
    }
    if (rule.frequency === 'ANNUAL') {
      assert.ok(rule.annualDueMonth, `${rule.formCode} missing annualDueMonth`);
      assert.ok(rule.annualDueDay, `${rule.formCode} missing annualDueDay`);
    }
  }
});

test('the obsolete 0605 Annual Registration Fee tax type has no rules (abolished under EOPT Act, Jan 2024)', () => {
  assert.deepEqual(findRulesForTaxType('Annual Registration Fee (Form 0605)'), []);
});

test('a tax type can map to multiple filing rules', () => {
  assert.equal(compWithholdingRules.length, 2, 'expected 1601-C monthly + 1604-C annual');
  assert.equal(expandedWithholdingRules.length, 3, 'expected 0619-E monthly + 1601-EQ quarterly + 1604-E annual');
  assert.equal(corpIncomeTaxRules.length, 2, 'expected 1702Q quarterly + 1702 annual');
});

test('monthly rule: due date is the Nth of the month AFTER the period month', () => {
  const today = new Date(2026, 7, 1); // Aug 1, 2026
  const results = computeUpcomingDueDates(monthlyCompWithholding, 3, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-08-10'), `expected 2026-08-10 in ${JSON.stringify(dueDates)}`);
  assert.ok(dueDates.includes('2026-09-10'));
  assert.ok(dueDates.includes('2026-10-10'));
});

test('monthly rule crosses a year boundary correctly', () => {
  const today = new Date(2026, 9, 15); // Oct 15, 2026 (before the December exception kicks in)
  const results = computeUpcomingDueDates(monthlyCompWithholding, 3, today);
  const dueDates = results.map((r) => r.dueDate);
  for (const d of dueDates) {
    const [y] = d.split('-');
    assert.ok(Number(y) === 2026 || Number(y) === 2027, `unexpected year drift in ${d}`);
  }
});

test('REGRESSION: December 1601-C is due Jan 15, not the usual 10th', () => {
  const today = new Date(2026, 11, 1); // Dec 1, 2026
  const results = computeUpcomingDueDates(monthlyCompWithholding, 2, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2027-01-15'), `expected the December-exception date 2027-01-15 in ${JSON.stringify(dueDates)}`);
  assert.ok(!dueDates.includes('2027-01-10'), 'must NOT use the standard 10th for the December period');
});

test('REGRESSION: 0619-E skips the 3rd month of each quarter (superseded by 1601-EQ)', () => {
  const today = new Date(2026, 7, 1); // Aug 1, 2026 -- Sep (month index 8) is Q3's 3rd month
  const results = computeUpcomingDueDates(monthly0619E, 3, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-08-10'), 'Jul period (1st month of Q3) should produce Aug 10');
  assert.ok(dueDates.includes('2026-09-10'), 'Aug period (2nd month of Q3) should produce Sep 10');
  assert.ok(!dueDates.includes('2026-10-10'), 'Sep period (3rd month of Q3) must be skipped -- no Oct 10');
});

test('quarterly rule: VAT is due 25 days after each calendar quarter end', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(vatRule, 12, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-01-25'), `expected 2026-01-25 in ${JSON.stringify(dueDates)}`);
  assert.ok(dueDates.includes('2026-04-25'));
  assert.ok(dueDates.includes('2026-07-25'));
  assert.ok(dueDates.includes('2026-10-25'));
});

test('quarterly rule crosses a year boundary correctly (Q4 due date lands in January)', () => {
  const today = new Date(2026, 11, 1); // Dec 1, 2026
  const results = computeUpcomingDueDates(vatRule, 2, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2027-01-25'), `expected 2027-01-25 in ${JSON.stringify(dueDates)}`);
});

test('REGRESSION: 1601-EQ is due the LAST DAY of the next month, not a flat +30 days', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(quarterly1601EQ, 12, today);
  const dueDates = results.map((r) => r.dueDate);
  // Q1 (ends Mar 31) -> Apr 30 (April has 30 days -- this one happens to match a flat +30 too)
  assert.ok(dueDates.includes('2026-04-30'), `expected 2026-04-30 in ${JSON.stringify(dueDates)}`);
  // Q2 (ends Jun 30) -> Jul 31, NOT Jul 30 -- July has 31 days. This is exactly where a flat
  // +30-day offset would have been wrong.
  assert.ok(dueDates.includes('2026-07-31'), `expected 2026-07-31 in ${JSON.stringify(dueDates)}`);
  assert.ok(!dueDates.includes('2026-07-30'), 'must not use a flat +30 day offset');
  // Q3 (ends Sep 30) -> Oct 31, NOT Oct 30
  assert.ok(dueDates.includes('2026-10-31'), `expected 2026-10-31 in ${JSON.stringify(dueDates)}`);
  assert.ok(!dueDates.includes('2026-10-30'));
});

test('REGRESSION: 1601-FQ (final withholding) uses the same last-day-of-next-month rule as 1601-EQ', () => {
  const today = new Date(2026, 3, 1); // Apr 1, 2026
  const results = computeUpcomingDueDates(quarterly1601FQ, 4, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-07-31'), `expected 2026-07-31 in ${JSON.stringify(dueDates)}`);
});

test('1601-EQ/1601-FQ due date crosses a year boundary correctly (Q4 -> January)', () => {
  const today = new Date(2026, 11, 1); // Dec 1, 2026
  const results = computeUpcomingDueDates(quarterly1601EQ, 2, today);
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2027-01-31'), `expected 2027-01-31 in ${JSON.stringify(dueDates)}`);
});

test('REGRESSION: 1702Q (quarterly corporate income tax) never generates a Q4 occurrence', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(quarterly1702Q, 14, today);
  const labels = results.map((r) => r.periodLabel);
  assert.ok(!labels.some((l) => l.startsWith('Q4')), `Q4 should never appear, got labels: ${JSON.stringify(labels)}`);
  const dueDates = results.map((r) => r.dueDate);
  // Published example dates for a calendar-year corporation (60 days after quarter-close)
  assert.ok(dueDates.includes('2026-05-30'), `Q1 2026 expected 2026-05-30 in ${JSON.stringify(dueDates)}`);
  assert.ok(dueDates.includes('2026-08-29'), `Q2 2026 expected 2026-08-29 in ${JSON.stringify(dueDates)}`);
  assert.ok(dueDates.includes('2026-11-29'), `Q3 2026 expected 2026-11-29 in ${JSON.stringify(dueDates)}`);
});

test('annual rule returns exactly one occurrence per year within the window', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(annualCorpItr, 16, today); // 16 months safely covers two Aprils
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-04-15'));
  assert.ok(dueDates.includes('2027-04-15'));
  assert.equal(dueDates.length, 2);
});

test('annual rule with a short window returns nothing once the date has passed this year', () => {
  const today = new Date(2026, 4, 1); // May 1, 2026 -- April 15 already passed
  const results = computeUpcomingDueDates(annualCorpItr, 3, today); // window ends Aug 1, well before next April
  assert.equal(results.length, 0);
});

test('the two new annual alphalist rules (1604-C, 1604-E) land on the correct dates', () => {
  const today = new Date(2026, 0, 1);
  const compResults = computeUpcomingDueDates(annualCompAlphalist, 3, today);
  assert.ok(compResults.map((r) => r.dueDate).includes('2026-01-31'));

  const ewtResults = computeUpcomingDueDates(annual1604E, 4, today);
  assert.ok(ewtResults.map((r) => r.dueDate).includes('2026-03-01'));
});

test('results are sorted chronologically and each period appears only once', () => {
  const today = new Date(2026, 0, 15);
  const results = computeUpcomingDueDates(vatRule, 12, today);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].dueDate >= results[i - 1].dueDate, 'results must be sorted');
  }
  const uniqueDates = new Set(results.map((r) => r.dueDate));
  assert.equal(uniqueDates.size, results.length, 'no duplicate due dates expected');
});

test('unknown tax type returns an empty array rather than throwing', () => {
  assert.deepEqual(findRulesForTaxType('Not A Real Tax Type'), []);
});

test('planDeadlineGeneration: a client with a registered tax type generates deadline+task items for every applicable rule', () => {
  const today = new Date(2026, 7, 1); // Aug 1, 2026
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['Compensation Withholding (Form 1601-C)'] }];
  const plan = planDeadlineGeneration(clients, [], [], 6, today);

  assert.ok(plan.length > 0, 'expected at least one planned item');
  const formCodes = new Set(plan.map((i) => i.formCode));
  assert.ok(formCodes.has('1601-C'), 'expected at least one monthly 1601-C item');
  assert.ok(formCodes.has('1604-C'), 'expected the annual 1604-C item within a 6-month window spanning Jan 31');
  for (const item of plan) {
    assert.equal(item.clientId, 1);
    assert.equal(item.clientName, 'Acme Corp');
    assert.ok(['1601-C', '1604-C'].includes(item.formCode));
  }
});

test('planDeadlineGeneration: tax types without a BIR rule (LGU, SSS) are skipped entirely', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['Local Business Tax (LGU Permits)', 'SSS / PhilHealth / Pag-IBIG Contributions'] }];
  const plan = planDeadlineGeneration(clients, [], [], 3, today);
  assert.equal(plan.length, 0, 'manual-only tax types must not produce planned items');
});

test('planDeadlineGeneration: the obsolete 0605 tax type produces nothing even if an old client record still has it selected', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Legacy Client', applicableTaxes: ['Annual Registration Fee (Form 0605)'] }];
  const plan = planDeadlineGeneration(clients, [], [], 12, today);
  assert.equal(plan.length, 0);
});

test('planDeadlineGeneration: a client with no applicableTaxes produces nothing', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Empty Client', applicableTaxes: [] }, { id: 2, name: 'Null Client', applicableTaxes: null }];
  const plan = planDeadlineGeneration(clients, [], [], 3, today);
  assert.equal(plan.length, 0);
});

test('planDeadlineGeneration: is idempotent -- running again after everything is "created" plans nothing new', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['VAT (Form 2550Q)'] }];

  const firstPlan = planDeadlineGeneration(clients, [], [], 3, today);
  assert.ok(firstPlan.length > 0);

  const existingDeadlines = firstPlan.map((item) => ({
    clientId: item.clientId,
    formCode: item.formCode,
    deadlineDate: item.deadlineDate,
  }));
  const existingTasks = firstPlan.map((item) => ({
    clientName: item.clientName,
    category: item.category,
    dueDate: item.deadlineDate,
  }));

  const secondPlan = planDeadlineGeneration(clients, existingDeadlines, existingTasks, 3, today);
  assert.equal(secondPlan.length, 0, 'nothing should be re-planned once everything already exists');
});

test('planDeadlineGeneration: only fills in the missing half when a deadline exists but the task does not (or vice versa)', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['VAT (Form 2550Q)'] }];

  const firstPlan = planDeadlineGeneration(clients, [], [], 3, today);
  const oneItem = firstPlan[0];

  const planWithDeadlineOnly = planDeadlineGeneration(
    clients,
    [{ clientId: oneItem.clientId, formCode: oneItem.formCode, deadlineDate: oneItem.deadlineDate }],
    [],
    3,
    today
  );
  const matching = planWithDeadlineOnly.find((i) => i.deadlineDate === oneItem.deadlineDate);
  assert.ok(matching, 'the period should still be planned since the task is missing');
  assert.equal(matching!.needsDeadline, false);
  assert.equal(matching!.needsTask, true);
});

test('planDeadlineGeneration: two different clients with the same tax type are planned independently', () => {
  const today = new Date(2026, 7, 1);
  const clients = [
    { id: 1, name: 'Acme Corp', applicableTaxes: ['VAT (Form 2550Q)'] },
    { id: 2, name: 'Beta Inc', applicableTaxes: ['VAT (Form 2550Q)'] },
  ];
  const plan = planDeadlineGeneration(clients, [], [], 3, today);
  const acmeItems = plan.filter((i) => i.clientId === 1);
  const betaItems = plan.filter((i) => i.clientId === 2);
  assert.ok(acmeItems.length > 0);
  assert.ok(betaItems.length > 0);
  assert.equal(acmeItems.length, betaItems.length, 'both clients registered for the same tax should get the same number of periods');
});
