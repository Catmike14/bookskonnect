import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTeamPerformance, formatCategoryChartLabel } from '../src/utils/teamPerformance';
import { Task, User } from '../src/types';

const alice: User = { id: 1, name: 'Alice Reyes', role: 'Bookkeeper', avatar: 'a.png', email: 'alice@test.com' };
const bob: User = { id: 2, name: 'Bob Cruz', role: 'Tax Specialist', avatar: 'b.png', email: 'bob@test.com' };

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    title: 'Test task',
    clientName: 'Test Client',
    description: '',
    status: 'OPEN',
    category: 'VAT 2550Q',
    priority: 'NORMAL',
    flagged: false,
    creator: alice,
    assignee: alice,
    comments: [],
    reactions: {},
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    auditLog: [],
    ...overrides,
  };
}

test('formatCategoryChartLabel strips a standalone "Tax" word and collapses the resulting double space', () => {
  assert.equal(formatCategoryChartLabel('Percentage Tax 2551Q'), 'Percentage 2551Q');
  assert.equal(formatCategoryChartLabel('Withholding Tax 1601-C'), 'Withholding 1601-C');
  assert.equal(formatCategoryChartLabel('Individual Income Tax 1701'), 'Individual Income 1701');
});

test('formatCategoryChartLabel leaves categories without a standalone "Tax" word unchanged', () => {
  assert.equal(formatCategoryChartLabel('VAT 2550Q'), 'VAT 2550Q');
  assert.equal(formatCategoryChartLabel('Annual ITR 1702'), 'Annual ITR 1702');
  assert.equal(formatCategoryChartLabel('Expanded Withholding 0619-E'), 'Expanded Withholding 0619-E');
});

test('computeTeamPerformance: an open task counts toward totalAssigned but not completedCount', () => {
  const tasks = [makeTask({ status: 'OPEN' })];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  assert.equal(alicePerf.totalAssigned, 1);
  assert.equal(alicePerf.completedCount, 0);
  assert.equal(alicePerf.formattedTime, 'No filings closed yet');
});

test('computeTeamPerformance: a task counts toward its assignee, falling back to creator when unassigned', () => {
  const tasks = [
    makeTask({ creator: alice, assignee: bob }),
    makeTask({ creator: alice, assignee: undefined }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  const bobPerf = result.find((r) => r.name === 'Bob Cruz')!;
  assert.equal(bobPerf.totalAssigned, 1, 'the assigned task should count toward the assignee, not the creator');
  assert.equal(alicePerf.totalAssigned, 1, 'the unassigned task should fall back to the creator');
});

test('computeTeamPerformance: straightforward completion measures creation-to-done correctly', () => {
  const tasks = [
    makeTask({
      status: 'DONE',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T13:00:00.000Z',
      auditLog: [
        { id: 'log1', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        { id: 'log2', timestamp: '2026-08-01T13:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  assert.equal(alicePerf.completedCount, 1);
  assert.equal(alicePerf.totalHours, 4, 'expected exactly 4 hours between the two log timestamps');
  assert.equal(alicePerf.formattedTime, '4.0 hrs avg');
});

test('REGRESSION: a task completed, reopened, and completed again is measured against the FINAL completion, not the first', () => {
  const tasks = [
    makeTask({
      status: 'DONE',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-03T09:00:00.000Z',
      auditLog: [
        { id: 'log1', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        // First completion, only 1 hour after creation -- fast, but then reopened
        { id: 'log2', timestamp: '2026-08-01T10:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
        { id: 'log3', timestamp: '2026-08-02T09:00:00.000Z', user: 'Manager', action: 'Changed status to IN_PROGRESS' },
        // Final completion, 2 days after creation -- this is the one that actually reflects reality
        { id: 'log4', timestamp: '2026-08-03T09:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  // 2026-08-01T09:00 to 2026-08-03T09:00 = exactly 48 hours. A buggy
  // "find the FIRST done entry" implementation would instead compute just
  // 1 hour (creation to the very first, later-reversed completion).
  assert.equal(alicePerf.totalHours, 48, `expected 48 hours (final completion), got ${alicePerf.totalHours}`);
  assert.notEqual(alicePerf.totalHours, 1, 'must not use the first (later reopened) completion');
});

test('computeTeamPerformance: turnaround has a 0.5 hour floor to avoid zero/negative durations', () => {
  const tasks = [
    makeTask({
      status: 'DONE',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
      auditLog: [
        { id: 'log1', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        { id: 'log2', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  assert.equal(alicePerf.totalHours, 0.5);
});

test('computeTeamPerformance: multiple completed tasks average correctly', () => {
  const tasks = [
    makeTask({
      status: 'DONE',
      auditLog: [
        { id: 'a1', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        { id: 'a2', timestamp: '2026-08-01T11:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
    makeTask({
      status: 'DONE',
      auditLog: [
        { id: 'b1', timestamp: '2026-08-02T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        { id: 'b2', timestamp: '2026-08-02T15:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  assert.equal(alicePerf.completedCount, 2);
  assert.equal(alicePerf.totalHours, 8, '2 hours + 6 hours = 8 total');
  assert.equal(alicePerf.avgHours, 4, '8 hours / 2 completed tasks = 4 average');
});

test('computeTeamPerformance: formattedTime switches to days once average exceeds 24 hours', () => {
  const tasks = [
    makeTask({
      status: 'DONE',
      auditLog: [
        { id: 'a1', timestamp: '2026-08-01T09:00:00.000Z', user: 'Alice Reyes', action: 'Created task broadcast' },
        { id: 'a2', timestamp: '2026-08-03T09:00:00.000Z', user: 'Alice Reyes', action: 'Changed status to DONE' },
      ],
    }),
  ];
  const result = computeTeamPerformance(tasks);
  const alicePerf = result.find((r) => r.name === 'Alice Reyes')!;
  assert.equal(alicePerf.totalHours, 48);
  assert.match(alicePerf.formattedTime, /days avg/);
});

test('computeTeamPerformance: a task with no assignee and no creator is skipped without throwing', () => {
  const tasks = [makeTask({ creator: undefined as any, assignee: undefined })];
  assert.doesNotThrow(() => computeTeamPerformance(tasks));
  assert.equal(computeTeamPerformance(tasks).length, 0);
});
