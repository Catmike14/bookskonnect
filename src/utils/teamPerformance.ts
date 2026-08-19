import { Task } from '../types';

export interface TeamPerformanceEntry {
  name: string;
  role: string;
  avatar: string;
  completedCount: number;
  totalAssigned: number;
  totalHours: number;
  avgHours: number;
  formattedTime: string;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

/**
 * Per-team-member workload and turnaround stats, derived from each task's
 * audit log. A task counts toward whoever it's assigned to, falling back
 * to its creator if unassigned.
 *
 * Turnaround time for a completed task is measured from its first audit
 * log entry (creation) to its MOST RECENT "done"-ish entry -- not the
 * first one. A task that was completed, reopened for rework, and
 * completed again should have its turnaround measured against what
 * actually got it to its current DONE state, not an earlier, shorter-lived
 * completion that was later reversed.
 */
export function computeTeamPerformance(tasks: Task[]): TeamPerformanceEntry[] {
  const map: Record<string, Omit<TeamPerformanceEntry, 'avgHours' | 'formattedTime'>> = {};

  for (const task of tasks) {
    const member = task.assignee || task.creator;
    if (!member) continue;
    const name = member.name;

    if (!map[name]) {
      map[name] = {
        name,
        role: member.role || 'Team Member',
        avatar: member.avatar || DEFAULT_AVATAR,
        completedCount: 0,
        totalAssigned: 0,
        totalHours: 0,
      };
    }

    map[name].totalAssigned += 1;

    if (task.status === 'DONE') {
      map[name].completedCount += 1;

      const doneLog = task.auditLog
        ? [...task.auditLog].reverse().find((a) =>
            a.action.toLowerCase().includes('done') ||
            a.action.toLowerCase().includes('completed') ||
            a.action.toLowerCase().includes('marked as done')
          )
        : undefined;
      const startLog = task.auditLog?.[0];

      const startTime = startLog ? new Date(startLog.timestamp).getTime() : new Date(task.createdAt).getTime();
      const endTime = doneLog ? new Date(doneLog.timestamp).getTime() : new Date(task.updatedAt).getTime();

      const diffHours = Math.max(0.5, (endTime - startTime) / (1000 * 3600));
      map[name].totalHours += diffHours;
    }
  }

  return Object.values(map).map((member) => {
    const avgHours = member.completedCount > 0 ? member.totalHours / member.completedCount : 0;
    let formattedTime = 'No filings closed yet';
    if (member.completedCount > 0) {
      formattedTime = avgHours < 24
        ? `${avgHours.toFixed(1)} hrs avg`
        : `${(avgHours / 24).toFixed(1)} days avg (${avgHours.toFixed(0)} hrs)`;
    }
    return { ...member, avgHours: Number(avgHours.toFixed(1)), formattedTime };
  });
}

/**
 * Shortens a tax category name for chart labels by dropping a standalone
 * "Tax" word (e.g. "Percentage Tax 2551Q" -> "Percentage 2551Q"). Uses a
 * word-boundary match rather than a plain substring replace so it can't
 * accidentally chew into an unrelated word that happens to contain "tax"
 * as a substring, and collapses the double space left behind in the
 * middle of the string (.trim() only strips the ends, not internal gaps).
 */
export function formatCategoryChartLabel(category: string): string {
  return category.replace(/\bTax\b/, '').replace(/\s+/g, ' ').trim();
}
