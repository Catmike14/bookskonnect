import React from 'react';
import { Task, Client } from '../types';
import { exportTasksToCsv, exportClientsToCsv, downloadCsv } from '../utils/exportUtils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers,
  PieChart as PieChartIcon,
  Download,
  FileSpreadsheet,
  Timer,
  UserCheck,
  Zap,
  TrendingUp
} from 'lucide-react';

interface ComplianceAnalyticsProps {
  tasks: Task[];
  clients: Client[];
}

const STATUS_COLORS = {
  'OPEN': '#38bdf8',       // sky blue
  'IN_PROGRESS': '#f59e0b',// amber
  'PENDING_REVIEW': '#a855f7', // purple
  'DONE': '#10b981',       // emerald
};

export const ComplianceAnalytics: React.FC<ComplianceAnalyticsProps> = ({ tasks, clients }) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'DONE').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const flaggedTasks = tasks.filter(t => t.flagged);
  const urgentTasks = tasks.filter(t => t.priority === 'URGENT');

  const handleExportTasksCsv = () => {
    const csv = exportTasksToCsv(tasks);
    downloadCsv(`Compliance_Feed_Tasks_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const handleExportClientsCsv = () => {
    const csv = exportClientsToCsv(clients);
    downloadCsv(`Clients_Directory_${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  // Prepare data for Status Pie Chart
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: 'Open', value: statusCounts['OPEN'] || 0, color: STATUS_COLORS['OPEN'] },
    { name: 'In Progress', value: statusCounts['IN_PROGRESS'] || 0, color: STATUS_COLORS['IN_PROGRESS'] },
    { name: 'Pending Review', value: statusCounts['PENDING_REVIEW'] || 0, color: STATUS_COLORS['PENDING_REVIEW'] },
    { name: 'Done', value: statusCounts['DONE'] || 0, color: STATUS_COLORS['DONE'] },
  ];

  // Prepare data for Tax Category Bar Chart
  const categoryCounts = tasks.reduce((acc, task) => {
    acc[task.category] = (acc[task.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.keys(categoryCounts).map(cat => ({
    category: cat.replace('Tax', '').trim(),
    count: categoryCounts[cat]
  }));

  // Calculate Average Time to Completion per team member from audit logs
  const teamPerformanceMap: Record<string, {
    name: string;
    role: string;
    avatar: string;
    completedCount: number;
    totalAssigned: number;
    totalHours: number;
  }> = {};

  tasks.forEach(task => {
    const member = task.assignee || task.creator;
    if (!member) return;
    const name = member.name;

    if (!teamPerformanceMap[name]) {
      teamPerformanceMap[name] = {
        name,
        role: member.role || 'Team Member',
        avatar: member.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        completedCount: 0,
        totalAssigned: 0,
        totalHours: 0
      };
    }

    teamPerformanceMap[name].totalAssigned += 1;

    if (task.status === 'DONE') {
      teamPerformanceMap[name].completedCount += 1;

      // Calculate time difference between start and completion
      const doneLog = task.auditLog?.find(a => 
        a.action.toLowerCase().includes('done') || 
        a.action.toLowerCase().includes('completed') ||
        a.action.toLowerCase().includes('marked as done')
      );
      const startLog = task.auditLog?.[0];

      const startTime = startLog ? new Date(startLog.timestamp).getTime() : new Date(task.createdAt).getTime();
      const endTime = doneLog ? new Date(doneLog.timestamp).getTime() : new Date(task.updatedAt).getTime();

      const diffHours = Math.max(0.5, (endTime - startTime) / (1000 * 3600));
      teamPerformanceMap[name].totalHours += diffHours;
    }
  });

  const teamPerformanceData = Object.values(teamPerformanceMap).map(member => {
    const avgHours = member.completedCount > 0 ? (member.totalHours / member.completedCount) : 0;
    let formattedTime = 'No filings closed yet';
    if (member.completedCount > 0) {
      if (avgHours < 24) {
        formattedTime = `${avgHours.toFixed(1)} hrs avg`;
      } else {
        formattedTime = `${(avgHours / 24).toFixed(1)} days avg (${avgHours.toFixed(0)} hrs)`;
      }
    }

    return {
      ...member,
      avgHours: Number(avgHours.toFixed(1)),
      formattedTime,
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Analytics Toolbar & CSV Export */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Firm Compliance Analytics & Audit Reports</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time workload metrics, BIR filing status breakdown, and CSV report export
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleExportTasksCsv}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Tasks CSV</span>
          </button>

          <button
            onClick={handleExportClientsCsv}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Clients CSV</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Completion Rate</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{completionRate}%</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {completedTasks} of {totalTasks} team filings closed
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Flagged Roadblocks</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600">{flaggedTasks.length}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Requires manager intervention
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Urgent Filings</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{urgentTasks.length}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Approaching tax deadline
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Client Accounts</span>
            <Layers className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{clients.length}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Active compliance retainers
          </p>
        </div>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600" />
              <span>Task Status Distribution</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Real-time team workload</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Categories Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              <span>Filings by Tax Category</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">BIR & Bookkeeping volume</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#0d9488" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Team Average Time to Completion Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <Timer className="w-5 h-5 text-indigo-600" />
              <span>Average Time to Completion per Team Member</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Turnaround speed computed directly from audit logs (creation timestamp to 'DONE' status update)
            </p>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-3 py-1 rounded-full border border-indigo-200 self-start sm:self-auto flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span>Audit-Log Grounded</span>
          </span>
        </div>

        {/* Team Member Performance Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamPerformanceData.map((tp, idx) => (
            <div key={idx} className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={tp.avatar}
                  alt={tp.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-2xs"
                />
                <div className="overflow-hidden">
                  <h4 className="font-bold text-slate-900 text-xs truncate">{tp.name}</h4>
                  <span className="text-[10px] font-semibold text-slate-500 block">{tp.role}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Avg Turnaround:
                  </span>
                  <strong className={tp.completedCount > 0 ? 'text-indigo-900 font-extrabold' : 'text-slate-400'}>
                    {tp.formattedTime}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Closed Filings:
                  </span>
                  <span className="font-bold text-slate-800">
                    {tp.completedCount} / {tp.totalAssigned} tasks
                  </span>
                </div>

                {/* Completion Progress Bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${tp.totalAssigned > 0 ? Math.round((tp.completedCount / tp.totalAssigned) * 100) : 0}%`
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                <span>Total log hours: <strong>{tp.totalHours.toFixed(1)} hrs</strong></span>
                <span className="font-mono text-emerald-700 font-bold">
                  {tp.totalAssigned > 0 ? `${Math.round((tp.completedCount / tp.totalAssigned) * 100)}% done` : '0%'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Bar Chart Breakdown */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Turnaround Time Comparison (Hours per Completed Filing)</span>
          </h4>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={teamPerformanceData} margin={{ left: 20, right: 20 }}>
                <XAxis type="number" unit=" hrs" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                  formatter={(val: any) => [`${val} hours average`, 'Avg Duration']}
                />
                <Bar dataKey="avgHours" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Flagged Roadblocks Summary Table */}
      {flaggedTasks.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-red-900 font-bold text-sm pb-2 border-b border-red-100">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>Active Team Roadblocks Requiring Manager Review</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {flaggedTasks.map((ft) => (
              <div key={ft.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-900">{ft.title} <span className="text-slate-500 font-normal">({ft.clientName})</span></div>
                  <div className="text-red-700 font-medium mt-0.5">Blocker: {ft.flagReason}</div>
                </div>
                <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                  {ft.creator.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
