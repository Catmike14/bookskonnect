import { Task, Client } from '../types';

/**
 * Downloads a generated CSV file in the browser
 */
export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Converts task feed list into a formatted CSV string
 */
export function exportTasksToCsv(tasks: Task[]): string {
  const headers = ['Task ID', 'Client Name', 'Title', 'Tax Category', 'Status', 'Priority', 'Due Date', 'Flagged Roadblock', 'Flag Reason', 'Assignee', 'Creator', 'Created Date'];

  const rows = tasks.map(t => [
    t.id,
    `"${(t.clientName || '').replace(/"/g, '""')}"`,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.dueDate || 'N/A',
    t.flagged ? 'YES' : 'NO',
    `"${(t.flagReason || '').replace(/"/g, '""')}"`,
    `"${(t.assignee?.name || '').replace(/"/g, '""')}"`,
    `"${(t.creator?.name || '').replace(/"/g, '""')}"`,
    t.createdAt
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Converts client directory list into a formatted CSV string
 */
export function exportClientsToCsv(clients: Client[]): string {
  const headers = ['Client ID', 'Company Name', 'TIN', 'Industry', 'Health Status', 'Active Engagements', 'Manager In Charge', 'Contact Email', 'Contact Phone', 'Notes'];

  const rows = clients.map(c => [
    c.id,
    `"${(c.name || '').replace(/"/g, '""')}"`,
    `"${(c.tin || '').replace(/"/g, '""')}"`,
    `"${(c.industry || '').replace(/"/g, '""')}"`,
    c.healthStatus,
    c.activeEngagementsCount,
    `"${(c.managerInCharge || '').replace(/"/g, '""')}"`,
    `"${(c.contactEmail || '').replace(/"/g, '""')}"`,
    `"${(c.contactPhone || '').replace(/"/g, '""')}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
