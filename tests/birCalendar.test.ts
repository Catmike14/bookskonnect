import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeUpcomingDueDates, BIR_FILING_CALENDAR, findRuleForTaxType, planDeadlineGeneration } from '../src/utils/birCalendar';

const vatRule = findRuleForTaxType('VAT (Form 2550Q)')!;
const withholdingRule = findRuleForTaxType('Compensation Withholding (Form 1601-C)')!;
const corpItrRule = findRuleForTaxType('Corporate Income Tax (Form 1702-RT/EX)')!;

test('every filing rule has a category and a valid frequency-specific config', () => {
  for (const rule of BIR_FILING_CALENDAR) {
    assert.ok(rule.category, `${rule.taxType} is missing a category`);
    if (rule.frequency === 'MONTHLY') assert.ok(rule.monthlyDueDay, `${rule.taxType} missing monthlyDueDay`);
    if (rule.frequency === 'QUARTERLY') assert.ok(rule.quarterlyOffsetDays, `${rule.taxType} missing quarterlyOffsetDays`);
    if (rule.frequency === 'ANNUAL') {
      assert.ok(rule.annualDueMonth, `${rule.taxType} missing annualDueMonth`);
      assert.ok(rule.annualDueDay, `${rule.taxType} missing annualDueDay`);
    }
  }
});

test('monthly rule: due date is the Nth of the month AFTER the period month', () => {
  const today = new Date(2026, 7, 1); // Aug 1, 2026
  const results = computeUpcomingDueDates(withholdingRule, 3, today);
  // July period -> due Aug 10; Aug period -> due Sep 10; Sep -> due Oct 10; Oct -> due Nov 10
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-08-10'), `expected 2026-08-10 in ${JSON.stringify(dueDates)}`);
  assert.ok(dueDates.includes('2026-09-10'));
  assert.ok(dueDates.includes('2026-10-10'));
});

test('monthly rule crosses a year boundary correctly', () => {
  const today = new Date(2026, 10, 15); // Nov 15, 2026
  const results = computeUpcomingDueDates(withholdingRule, 3, today);
  const dueDates = results.map((r) => r.dueDate);
  // December period's filing is due Jan 10, 2027 -- must roll into next year, not wrap to month 13 or similar
  assert.ok(dueDates.includes('2027-01-10'), `expected 2027-01-10 in ${JSON.stringify(dueDates)}`);
  for (const d of dueDates) {
    const [y] = d.split('-');
    assert.ok(Number(y) === 2026 || Number(y) === 2027, `unexpected year drift in ${d}`);
  }
});

test('quarterly rule: VAT is due 25 days after each calendar quarter end', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(vatRule, 12, today);
  const dueDates = results.map((r) => r.dueDate);
  // Q4 2025 (ended Dec 31, 2025) due Jan 25, 2026
  assert.ok(dueDates.includes('2026-01-25'), `expected 2026-01-25 in ${JSON.stringify(dueDates)}`);
  // Q1 2026 (ended Mar 31) due Apr 25, 2026
  assert.ok(dueDates.includes('2026-04-25'));
  // Q2 2026 (ended Jun 30) due Jul 25, 2026
  assert.ok(dueDates.includes('2026-07-25'));
  // Q3 2026 (ended Sep 30) due Oct 25, 2026
  assert.ok(dueDates.includes('2026-10-25'));
});

test('quarterly rule crosses a year boundary correctly (Q4 due date lands in January)', () => {
  const today = new Date(2026, 11, 1); // Dec 1, 2026
  const results = computeUpcomingDueDates(vatRule, 2, today);
  const dueDates = results.map((r) => r.dueDate);
  // Q4 2026 ends Dec 31, 2026; +25 days = Jan 25, 2027
  assert.ok(dueDates.includes('2027-01-25'), `expected 2027-01-25 in ${JSON.stringify(dueDates)}`);
});

test('annual rule returns exactly one occurrence per year within the window', () => {
  const today = new Date(2026, 0, 1); // Jan 1, 2026
  const results = computeUpcomingDueDates(corpItrRule, 16, today); // 16 months safely covers two Aprils
  const dueDates = results.map((r) => r.dueDate);
  assert.ok(dueDates.includes('2026-04-15'));
  assert.ok(dueDates.includes('2027-04-15'));
  assert.equal(dueDates.length, 2);
});

test('annual rule with a short window returns nothing once the date has passed this year', () => {
  const today = new Date(2026, 4, 1); // May 1, 2026 -- April 15 already passed
  const results = computeUpcomingDueDates(corpItrRule, 3, today); // window ends Aug 1, well before next April
  assert.equal(results.length, 0);
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

test('unknown tax type returns undefined rather than throwing', () => {
  assert.equal(findRuleForTaxType('Not A Real Tax Type'), undefined);
});

test('planDeadlineGeneration: a client with a registered tax type generates deadline+task items', () => {
  const today = new Date(2026, 7, 1); // Aug 1, 2026
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['Compensation Withholding (Form 1601-C)'] }];
  const plan = planDeadlineGeneration(clients, [], [], 2, today);

  assert.ok(plan.length > 0, 'expected at least one planned item');
  for (const item of plan) {
    assert.equal(item.clientId, 1);
    assert.equal(item.clientName, 'Acme Corp');
    assert.equal(item.formCode, '1601-C');
    assert.equal(item.needsDeadline, true);
    assert.equal(item.needsTask, true);
  }
});

test('planDeadlineGeneration: tax types without a BIR rule (LGU, SSS) are skipped entirely', () => {
  const today = new Date(2026, 7, 1);
  const clients = [{ id: 1, name: 'Acme Corp', applicableTaxes: ['Local Business Tax (LGU Permits)', 'SSS / PhilHealth / Pag-IBIG Contributions'] }];
  const plan = planDeadlineGeneration(clients, [], [], 3, today);
  assert.equal(plan.length, 0, 'manual-only tax types must not produce planned items');
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

  // Simulate the caller having created every deadline and task the plan called for
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

  // Deadline already exists, task does not
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
