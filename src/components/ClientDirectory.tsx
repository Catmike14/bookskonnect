import React, { useState } from 'react';
import { 
  Client, 
  Task, 
  TaxDeadline,
  COMMON_TAX_TYPES, 
  ENTITY_TYPES,
  TAX_REGISTRATION_TYPES, 
  COMMON_RDO_CODES, 
  COMMON_RETAINER_SERVICES 
} from '../types';
import { ClientDetailModal } from './ClientDetailModal';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileText,
  Building,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Receipt,
  Shield,
  User,
  Check
} from 'lucide-react';

interface ClientDirectoryProps {
  clients: Client[];
  tasks: Task[];
  deadlines?: TaxDeadline[];
  onSelectClientForBroadcast: (clientName: string) => void;
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onUpdateClientNotes: (clientId: number, newNotes: string, newHealth?: Client['healthStatus'], fullClientData?: Partial<Client>) => void;
  onDeleteClient?: (clientId: number) => void;
  onGenerateDeadlines?: (clientId?: number) => { deadlinesCreated: number; tasksCreated: number; clientsCovered: number };
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({
  clients,
  tasks,
  deadlines = [],
  onSelectClientForBroadcast,
  onAddClient,
  onUpdateClientNotes,
  onDeleteClient,
  onGenerateDeadlines,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedTaxFilter, setSelectedTaxFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDetailClient, setSelectedDetailClient] = useState<Client | null>(null);
  const [duplicateTinError, setDuplicateTinError] = useState('');

  const [newClient, setNewClient] = useState({
    name: '',
    industry: '',
    tin: '',
    rdoCode: 'RDO 044 - Taguig / Pateros',
    secDtiNumber: '',
    entityType: 'Corporation',
    taxRegistrationType: 'VAT Registered (12%)',
    applicableTaxes: [
      'VAT (Form 2550Q)',
      'Compensation Withholding (Form 1601-C)',
      'Expanded Withholding (Form 0619-E / 1601-EQ)',
      'Corporate Income Tax (Form 1702-RT/EX)'
    ] as string[],
    activeEngagementsCount: 2,
    managerInCharge: '',
    healthStatus: 'Good' as 'Good' | 'At Risk' | 'Needs Documents',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    registeredAddress: '',
    accountingMethod: 'Accrual Basis',
    fiscalYearEnd: 'Calendar Year (Dec 31)',
    subscribedServices: [
      'Bookkeeping & General Ledger',
      'BIR Tax Filing & Compliance'
    ] as string[],
    notes: ''
  });

  const toggleApplicableTax = (taxName: string) => {
    setNewClient(prev => {
      const exists = prev.applicableTaxes.includes(taxName);
      const updated = exists 
        ? prev.applicableTaxes.filter(t => t !== taxName)
        : [...prev.applicableTaxes, taxName];
      return {
        ...prev,
        applicableTaxes: updated,
        activeEngagementsCount: Math.max(1, updated.length)
      };
    });
  };

  const toggleSubscribedService = (serviceName: string) => {
    setNewClient(prev => {
      const exists = prev.subscribedServices.includes(serviceName);
      const updated = exists 
        ? prev.subscribedServices.filter(s => s !== serviceName)
        : [...prev.subscribedServices, serviceName];
      return { ...prev, subscribedServices: updated };
    });
  };

  const filteredClients = clients.filter(c => {
    const query = filterQuery.toLowerCase();
    const matchesText = 
      c.name.toLowerCase().includes(query) ||
      c.industry.toLowerCase().includes(query) ||
      c.tin.includes(query) ||
      (c.rdoCode && c.rdoCode.toLowerCase().includes(query)) ||
      (c.taxRegistrationType && c.taxRegistrationType.toLowerCase().includes(query)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(query)) ||
      (c.contactEmail && c.contactEmail.toLowerCase().includes(query)) ||
      (c.applicableTaxes && c.applicableTaxes.some(t => t.toLowerCase().includes(query)));

    const matchesTaxType = 
      selectedTaxFilter === 'ALL' ||
      (c.applicableTaxes && c.applicableTaxes.some(t => t.toLowerCase().includes(selectedTaxFilter.toLowerCase()))) ||
      (c.taxRegistrationType && c.taxRegistrationType.toLowerCase().includes(selectedTaxFilter.toLowerCase()));

    return matchesText && matchesTaxType;
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateTinError('');
    if (!newClient.name || !newClient.tin) return;

    // Normalize away formatting differences (spaces, dashes) before
    // comparing, since "123-456-789-000" and "123456789000" refer to the
    // same taxpayer -- a naive exact-string check would miss that and let
    // the same client get added twice under slightly different formatting.
    const normalizedNewTin = newClient.tin.replace(/[^0-9]/g, '');
    const duplicate = clients.find(c => c.tin.replace(/[^0-9]/g, '') === normalizedNewTin && normalizedNewTin.length > 0);
    if (duplicate) {
      setDuplicateTinError(`A client with this TIN already exists: "${duplicate.name}". Check the directory before adding a duplicate record.`);
      return;
    }

    onAddClient(newClient);
    setShowAddModal(false);
    setNewClient({
      name: '',
      industry: '',
      tin: '',
      rdoCode: 'RDO 044 - Taguig / Pateros',
      secDtiNumber: '',
      entityType: 'Corporation',
      taxRegistrationType: 'VAT Registered (12%)',
      applicableTaxes: [
        'VAT (Form 2550Q)',
        'Compensation Withholding (Form 1601-C)',
        'Expanded Withholding (Form 0619-E / 1601-EQ)',
        'Corporate Income Tax (Form 1702-RT/EX)'
      ],
      activeEngagementsCount: 2,
      managerInCharge: '',
      healthStatus: 'Good',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      registeredAddress: '',
      accountingMethod: 'Accrual Basis',
      fiscalYearEnd: 'Calendar Year (Dec 31)',
      subscribedServices: [
        'Bookkeeping & General Ledger',
        'BIR Tax Filing & Compliance'
      ],
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
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span>Firm Client Accounts Directory</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage client compliance health, active BIR tax types for filing, RDO details, and assigned CPAs
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, TIN, RDO, or Tax Type..."
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
              <span>Add Client Account</span>
            </button>
          </div>
        </div>

        {/* Quick Tax Type Filter Pills */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Receipt className="w-3 h-3 text-slate-400" />
            Tax Type Filter:
          </span>
          <button
            onClick={() => setSelectedTaxFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] shrink-0 ${
              selectedTaxFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Accounts ({clients.length})
          </button>
          <button
            onClick={() => setSelectedTaxFilter('VAT')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] shrink-0 ${
              selectedTaxFilter === 'VAT'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80'
            }`}
          >
            VAT Registered
          </button>
          <button
            onClick={() => setSelectedTaxFilter('Percentage')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] shrink-0 ${
              selectedTaxFilter === 'Percentage'
                ? 'bg-teal-700 text-white'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200/80'
            }`}
          >
            Percentage Tax
          </button>
          <button
            onClick={() => setSelectedTaxFilter('Withholding')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] shrink-0 ${
              selectedTaxFilter === 'Withholding'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
            }`}
          >
            Withholding Tax
          </button>
          <button
            onClick={() => setSelectedTaxFilter('1702')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-[11px] shrink-0 ${
              selectedTaxFilter === '1702'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/80'
            }`}
          >
            Corporate ITR (1702)
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
          const taxList = client.applicableTaxes && client.applicableTaxes.length > 0
            ? client.applicableTaxes
            : ['VAT (Form 2550Q)', 'Compensation Withholding (Form 1601-C)', 'Corporate Income Tax (Form 1702-RT/EX)'];

          return (
            <div key={client.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition space-y-4 flex flex-col justify-between">
              
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-slate-900 tracking-tight">{client.name}</h3>
                      {client.entityType && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                          {client.entityType}
                        </span>
                      )}
                      {client.taxRegistrationType && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          {client.taxRegistrationType}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-medium block mt-0.5">{client.industry}</span>
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
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">BIR District (RDO)</span>
                    <span className="font-semibold text-emerald-800 truncate block">
                      {client.rdoCode || 'RDO 044 - Taguig'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Manager in Charge</span>
                    <span className="font-bold text-slate-800">{client.managerInCharge}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Contact Person</span>
                    <span className="font-medium text-slate-700 truncate block">
                      {client.contactPerson || client.contactEmail || 'Authorized CPA Rep'}
                    </span>
                  </div>
                </div>

                {/* Tax Types for Filing Badges */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-emerald-600" />
                    Active Tax Filing Obligations ({taxList.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {taxList.map((tax, idx) => (
                      <span 
                        key={idx}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 shrink-0"
                      >
                        {tax}
                      </span>
                    ))}
                  </div>
                </div>

                {client.notes && (
                  <p className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    <strong className="text-amber-900 font-semibold">CPA Note:</strong> {client.notes}
                  </p>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedDetailClient(client)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Tax Profile</span>
                  </button>

                  {onDeleteClient && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete client account "${client.name}"?`)) {
                          onDeleteClient(client.id);
                        }
                      }}
                      title="Delete Client Account"
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-xl transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

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

      {/* Comprehensive Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Add New Client Profile</h3>
                  <p className="text-xs text-slate-500">Configure BIR tax filing obligations, RDO info, and CPA assignment</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setDuplicateTinError(''); }} 
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {duplicateTinError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold shrink-0">
                {duplicateTinError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-5 text-xs overflow-y-auto pr-1 flex-1">
              
              {/* SECTION 1: CORPORATE IDENTITY & TAX CREDENTIALS */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-emerald-800">
                  <Building className="w-4 h-4 text-emerald-600" />
                  1. Corporate Identity & Tax Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Company Registered Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Commercial Trading Corp."
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Industry Sector</label>
                    <input
                      type="text"
                      placeholder="e.g. Retail, Real Estate, Technology"
                      value={newClient.industry}
                      onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">BIR Taxpayer Identification Number (TIN) *</label>
                    <input
                      type="text"
                      placeholder="000-000-000-000"
                      value={newClient.tin}
                      onChange={(e) => { setNewClient({ ...newClient, tin: e.target.value }); setDuplicateTinError(''); }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SEC / DTI Registration Number</label>
                    <input
                      type="text"
                      placeholder="CS202612345 / 01234567"
                      value={newClient.secDtiNumber}
                      onChange={(e) => setNewClient({ ...newClient, secDtiNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Entity / Organization Structure</label>
                    <select
                      value={newClient.entityType}
                      onChange={(e) => setNewClient({ ...newClient, entityType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                    >
                      {ENTITY_TYPES.map((type, i) => (
                        <option key={i} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tax Registration Type (BIR)</label>
                    <select
                      value={newClient.taxRegistrationType}
                      onChange={(e) => setNewClient({ ...newClient, taxRegistrationType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                    >
                      {TAX_REGISTRATION_TYPES.map((type, i) => (
                        <option key={i} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Account Operational Status</label>
                    <select
                      value={newClient.healthStatus}
                      onChange={(e) => setNewClient({ ...newClient, healthStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold"
                    >
                      <option value="Good">Good (All compliance up-to-date)</option>
                      <option value="Needs Documents">Needs Documents (Pending vouchers/2307)</option>
                      <option value="At Risk">At Risk (Roadblocks / overdue risks)</option>
                    </select>
                  </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BIR Revenue District Office (RDO) Code</label>
                  <select
                    value={newClient.rdoCode}
                    onChange={(e) => setNewClient({ ...newClient, rdoCode: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-medium"
                  >
                    {COMMON_RDO_CODES.map((rdo, i) => (
                      <option key={i} value={rdo}>{rdo}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

              {/* SECTION 2: ACTIVE BIR TAX FILING TYPES (SPECIFICALLY REQUESTED) */}
              <div className="space-y-3 bg-teal-50/60 p-4 rounded-2xl border border-teal-200/80">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-teal-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-teal-700" />
                    2. Active BIR Tax Filing Obligations (Tax Types)
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-200/60 text-teal-900">
                    {newClient.applicableTaxes.length} Selected
                  </span>
                </div>
                <p className="text-[11px] text-teal-700">
                  Select all BIR tax types this client is mandated to file regularly. This generates deadline reminders & task tags.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {COMMON_TAX_TYPES.map((taxName, idx) => {
                    const isSelected = newClient.applicableTaxes.includes(taxName);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleApplicableTax(taxName)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-white text-teal-800 border-white' : 'border-slate-300 bg-slate-50'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{taxName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: PRINCIPAL AUTHORIZED REPRESENTATIVE */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-emerald-800">
                  <User className="w-4 h-4 text-emerald-600" />
                  3. Principal Authorized Representative
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Maria Santos (CFO)"
                      value={newClient.contactPerson}
                      onChange={(e) => setNewClient({ ...newClient, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Contact Email</label>
                    <input
                      type="email"
                      placeholder="m.santos@company.ph"
                      value={newClient.contactEmail}
                      onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Telephone / Mobile</label>
                    <input
                      type="text"
                      placeholder="+63 917 123 4567"
                      value={newClient.contactPhone}
                      onChange={(e) => setNewClient({ ...newClient, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registered Business Address</label>
                  <input
                    type="text"
                    placeholder="Suite 802, BGC Corporate Tower, 36th St., Taguig City"
                    value={newClient.registeredAddress}
                    onChange={(e) => setNewClient({ ...newClient, registeredAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* SECTION 4: BILLING ENGAGEMENT & ACCOUNT MANAGEMENT */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-emerald-800">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  4. Accounting Setup & Subscribed Retainer Services
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Accounting Method</label>
                    <select
                      value={newClient.accountingMethod}
                      onChange={(e) => setNewClient({ ...newClient, accountingMethod: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    >
                      <option value="Accrual Basis">Accrual Basis</option>
                      <option value="Cash Basis">Cash Basis</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Fiscal Year End</label>
                    <select
                      value={newClient.fiscalYearEnd}
                      onChange={(e) => setNewClient({ ...newClient, fiscalYearEnd: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
                    >
                      <option value="Calendar Year (Dec 31)">Calendar Year (Dec 31)</option>
                      <option value="Fiscal Year (Mar 31)">Fiscal Year (Mar 31)</option>
                      <option value="Fiscal Year (Jun 30)">Fiscal Year (Jun 30)</option>
                      <option value="Fiscal Year (Sep 30)">Fiscal Year (Sep 30)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned CPA Handler</label>
                    <input
                      type="text"
                      placeholder="e.g. Michael Catorce"
                      value={newClient.managerInCharge}
                      onChange={(e) => setNewClient({ ...newClient, managerInCharge: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 font-semibold text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subscribed Retainer Services</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {COMMON_RETAINER_SERVICES.map((service, idx) => {
                      const isSelected = newClient.subscribedServices.includes(service);
                      return (
                        <label
                          key={idx}
                          onClick={() => toggleSubscribedService(service)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                            isSelected ? 'bg-white text-slate-900' : 'border-slate-300'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{service}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPA / Auditor Notes</label>
                  <textarea
                    placeholder="Record special tax exemptions, book mapping rules, or client instructions..."
                    value={newClient.notes}
                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 h-16 resize-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold cursor-pointer shadow-sm"
                >
                  Save Complete Client Profile
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
        deadlines={deadlines}
        onClose={() => setSelectedDetailClient(null)}
        onUpdateClientNotes={onUpdateClientNotes}
        onSelectForBroadcast={onSelectClientForBroadcast}
        onDeleteClient={onDeleteClient}
        onGenerateDeadlines={onGenerateDeadlines}
      />

    </div>
  );
};
