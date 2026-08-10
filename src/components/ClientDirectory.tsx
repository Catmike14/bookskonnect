import React, { useState } from 'react';
import { Client, Task } from '../types';
import { ClientDetailModal } from './ClientDetailModal';
import { 
  Building2, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileText,
  UserCheck,
  Building,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

interface ClientDirectoryProps {
  clients: Client[];
  tasks: Task[];
  onSelectClientForBroadcast: (clientName: string) => void;
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onUpdateClientNotes: (clientId: number, newNotes: string, newHealth?: Client['healthStatus']) => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({
  clients,
  tasks,
  onSelectClientForBroadcast,
  onAddClient,
  onUpdateClientNotes,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDetailClient, setSelectedDetailClient] = useState<Client | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    industry: '',
    tin: '',
    activeEngagementsCount: 1,
    managerInCharge: 'Michael Catorce',
    healthStatus: 'Good' as 'Good' | 'At Risk' | 'Needs Documents',
    contactEmail: '',
    contactPhone: '',
    notes: ''
  });

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.industry.toLowerCase().includes(filterQuery.toLowerCase()) ||
    c.tin.includes(filterQuery)
  );

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.tin) return;

    onAddClient(newClient);
    setShowAddModal(false);
    setNewClient({
      name: '',
      industry: '',
      tin: '',
      activeEngagementsCount: 1,
      managerInCharge: 'Michael Catorce',
      healthStatus: 'Good',
      contactEmail: '',
      contactPhone: '',
      notes: ''
    });
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'Good':
        return { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
      case 'Needs Documents':
        return { bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertCircle };
      case 'At Risk':
        return { bg: 'bg-red-50 text-red-800 border-red-200', icon: AlertTriangle };
      default:
        return { bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: CheckCircle2 };
    }
  };

  const getClientTrend = (client: Client, clientTasks: Task[]) => {
    const completed = clientTasks.filter(t => t.status === 'DONE');
    const openFlagged = clientTasks.filter(t => t.flagged && t.status !== 'DONE');

    if (openFlagged.length > 0 || client.healthStatus === 'At Risk') {
      return {
        trend: 'DOWN',
        text: 'Speed ↓',
        label: 'Delayed (Roadblocks)',
        tooltip: 'Task completion speed slowed due to unhandled roadblocks or missing documents',
        bg: 'bg-red-50 text-red-700 border-red-200',
        icon: TrendingDown
      };
    }

    if (completed.length === 0) {
      return {
        trend: 'STABLE',
        text: 'Speed ↔',
        label: 'Steady Pace',
        tooltip: 'Turnaround pace is normal based on current active filings',
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        icon: Minus
      };
    }

    // Calculate turnaround hours for completed tasks
    const durations = completed.map(t => {
      const doneLog = t.auditLog?.find(a => 
        a.action.toLowerCase().includes('done') || 
        a.action.toLowerCase().includes('completed') ||
        a.action.toLowerCase().includes('marked as done')
      );
      const startTime = new Date(t.createdAt).getTime();
      const endTime = doneLog ? new Date(doneLog.timestamp).getTime() : new Date(t.updatedAt).getTime();
      return Math.max(0.5, (endTime - startTime) / (1000 * 3600));
    });

    const avgHours = durations.reduce((a, b) => a + b, 0) / durations.length;

    if (avgHours <= 48 || client.healthStatus === 'Good') {
      const timeLabel = avgHours < 24 ? `${avgHours.toFixed(1)}h avg` : `${(avgHours / 24).toFixed(1)}d avg`;
      return {
        trend: 'UP',
        text: 'Speed ↑',
        label: `Fast (${timeLabel})`,
        tooltip: `Faster task completion speed (${timeLabel} turnaround)`,
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: TrendingUp
      };
    }

    return {
      trend: 'STABLE',
      text: 'Speed ↔',
      label: 'Moderate Pace',
      tooltip: `Moderate task completion speed (${(avgHours / 24).toFixed(1)}d avg turnaround)`,
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Minus
    };
  };

  return (
    <div className="space-y-6">
      
      {/* Directory Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <span>Firm Client Accounts Directory</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage client compliance health, active tax engagements, and primary managers
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by name, TIN, industry..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Client Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredClients.map((client) => {
          const health = getHealthBadge(client.healthStatus);
          const HealthIcon = health.icon;
          const clientTasks = tasks.filter(t => t.clientName.toLowerCase() === client.name.toLowerCase());
          const trend = getClientTrend(client, clientTasks);
          const TrendIcon = trend.icon;

          return (
            <div key={client.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition space-y-4">
              
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 tracking-tight">{client.name}</h3>
                  <span className="text-xs text-slate-500 font-medium block">{client.industry}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {/* Health Badge */}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${health.bg}`}>
                    <HealthIcon className="w-3.5 h-3.5" />
                    <span>{client.healthStatus}</span>
                  </span>

                  {/* Historical Completion Trend Indicator */}
                  <span 
                    title={trend.tooltip}
                    className={`text-xs font-extrabold px-2 py-1 rounded-xl border flex items-center gap-1 cursor-help ${trend.bg}`}
                  >
                    <TrendIcon className="w-3.5 h-3.5" />
                    <span>{trend.label}</span>
                  </span>
                </div>
              </div>

              {/* Detail Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Tax ID (TIN)</span>
                  <span className="font-mono font-semibold text-slate-800">{client.tin}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Manager in Charge</span>
                  <span className="font-bold text-slate-800">{client.managerInCharge}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Active Filings</span>
                  <span className="font-bold text-emerald-700">{client.activeEngagementsCount} Engagements</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Contact</span>
                  <span className="font-medium text-slate-700 truncate block">{client.contactEmail}</span>
                </div>
              </div>

              {client.notes && (
                <p className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <strong className="text-amber-900 font-semibold">CPA Note:</strong> {client.notes}
                </p>
              )}

              {/* Quick Action */}
              <div className="pt-1 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedDetailClient(client)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>View Filing History</span>
                </button>

                <button
                  onClick={() => onSelectClientForBroadcast(client.name)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Broadcast Update</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Add New Client Account</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Entity Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  placeholder="e.g. Retail, Real Estate, Technology"
                  value={newClient.industry}
                  onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">TIN Number *</label>
                  <input
                    type="text"
                    placeholder="000-000-000-000"
                    value={newClient.tin}
                    onChange={(e) => setNewClient({ ...newClient, tin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Health Status</label>
                  <select
                    value={newClient.healthStatus}
                    onChange={(e) => setNewClient({ ...newClient, healthStatus: e.target.value as any })}
                    className="w-full px-2 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  >
                    <option value="Good">Good</option>
                    <option value="Needs Documents">Needs Documents</option>
                    <option value="At Risk">At Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="accounting@client.com"
                  value={newClient.contactEmail}
                  onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CPA / Auditor Notes</label>
                <textarea
                  placeholder="Key compliance requirements or special instructions..."
                  value={newClient.notes}
                  onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Engagement Detail Modal */}
      <ClientDetailModal
        client={selectedDetailClient}
        tasks={tasks}
        onClose={() => setSelectedDetailClient(null)}
        onUpdateClientNotes={onUpdateClientNotes}
        onSelectForBroadcast={onSelectClientForBroadcast}
      />

    </div>
  );
};
