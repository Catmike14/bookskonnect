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
 * Quotes and escapes a value for a single CSV cell, and guards against CSV
 * formula injection: if the value starts with =, +, -, or @, Excel/Sheets
 * will treat it as a formula when the file is opened. Since these values
 * frequently come from free-text fields (task titles, client notes) that
 * anyone with an account can set, a value like `=HYPERLINK("http://evil","x")`
 * would otherwise execute for whoever opens the exported file. Prefixing
 * with a tab neutralizes it while keeping the visible text unchanged.
 */
function csvField(value: string | number | null | undefined): string {
  let str = String(value ?? '');
  if (/^[=+\-@]/.test(str)) {
    str = '\t' + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Converts task feed list into a formatted CSV string
 */
export function exportTasksToCsv(tasks: Task[]): string {
  const headers = ['Task ID', 'Client Name', 'Title', 'Tax Category', 'Status', 'Priority', 'Due Date', 'Flagged Roadblock', 'Flag Reason', 'Assignee', 'Creator', 'Created Date'];

  const rows = tasks.map(t => [
    t.id,
    csvField(t.clientName),
    csvField(t.title),
    csvField(t.category),
    t.status,
    t.priority,
    t.dueDate || 'N/A',
    t.flagged ? 'YES' : 'NO',
    csvField(t.flagReason),
    csvField(t.assignee?.name),
    csvField(t.creator?.name),
    t.createdAt
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Converts client directory list into a formatted CSV string
 */
export function exportClientsToCsv(clients: Client[]): string {
  const headers = [
    'Client ID', 'Company Name', 'TIN', 'Tax Reg Type', 'RDO Code', 'SEC/DTI No',
    'Industry', 'Health Status', 'Applicable Filing Taxes', 'Subscribed Services',
    'Contact Person', 'Contact Email', 'Contact Phone', 'Manager In Charge',
    'Accounting Method', 'Fiscal Year End', 'Registered Address', 'Notes'
  ];

  const rows = clients.map(c => [
    c.id,
    csvField(c.name),
    csvField(c.tin),
    csvField(c.taxRegistrationType),
    csvField(c.rdoCode),
    csvField(c.secDtiNumber),
    csvField(c.industry),
    c.healthStatus,
    csvField(c.applicableTaxes ? c.applicableTaxes.join('; ') : ''),
    csvField(c.subscribedServices ? c.subscribedServices.join('; ') : ''),
    csvField(c.contactPerson),
    csvField(c.contactEmail),
    csvField(c.contactPhone),
    csvField(c.managerInCharge),
    csvField(c.accountingMethod),
    csvField(c.fiscalYearEnd),
    csvField(c.registeredAddress),
    csvField(c.notes)
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
