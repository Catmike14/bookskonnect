import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiFetch';
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
import { 
  X, 
  Building2, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  PlusCircle, 
  Copy, 
  Check,
  Loader2,
  Calendar,
  Trash2,
  Receipt,
  Building,
  User,
  Shield,
  Briefcase
} from 'lucide-react';
interface ClientDetailModalProps {
  client: Client | null;
  tasks: Task[];
  deadlines?: TaxDeadline[];
  onClose: () => void;
  onUpdateClientNotes: (clientId: number, newNotes: string, newHealth?: Client['healthStatus'], fullClientData?: Partial<Client>) => void;
  onSelectForBroadcast: (clientName: string) => void;
  onDeleteClient?: (clientId: number) => void;
  onGenerateDeadlines?: (clientId?: number) => { deadlinesCreated: number; tasksCreated: number; clientsCovered: number };
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  tasks,
  deadlines = [],
  onClose,
  onUpdateClientNotes,
  onSelectForBroadcast,
  onDeleteClient,
  onGenerateDeadlines,
}) => {
  if (!client) return null;

  const [activeTab, setActiveTab] = useState<'TASKS' | 'DEADLINES' | 'INFO' | 'EMAIL_GEN'>('TASKS');

  // Form state initialized from client props
  const [formData, setFormData] = useState({
    name: client.name,
    industry: client.industry,
    tin: client.tin,
    rdoCode: client.rdoCode || 'RDO 044 - Taguig / Pateros',
    secDtiNumber: client.secDtiNumber || '',
    entityType: client.entityType || 'Corporation',
    taxRegistrationType: client.taxRegistrationType || 'VAT Registered (12%)',
    applicableTaxes: client.applicableTaxes || [
      'VAT (Form 2550Q)',
      'Compensation Withholding (Form 1601-C)',
      'Expanded Withholding (Form 0619-E / 1601-EQ)',
      'Corporate Income Tax (Form 1702-RT/EX)'
    ],
    managerInCharge: client.managerInCharge,
    healthStatus: client.healthStatus,
    contactPerson: client.contactPerson || '',
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    registeredAddress: client.registeredAddress || '',
    accountingMethod: client.accountingMethod || 'Accrual Basis',
    fiscalYearEnd: client.fiscalYearEnd || 'Calendar Year (Dec 31)',
    subscribedServices: client.subscribedServices || [
      'Bookkeeping & General Ledger',
      'BIR Tax Filing & Compliance'
    ],
    notes: client.notes || ''
  });

  const [isSavedNotes, setIsSavedNotes] = useState(false);

  // Sync state when client changes
  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        industry: client.industry,
        tin: client.tin,
        rdoCode: client.rdoCode || 'RDO 044 - Taguig / Pateros',
        secDtiNumber: client.secDtiNumber || '',
        entityType: client.entityType || 'Corporation',
        taxRegistrationType: client.taxRegistrationType || 'VAT Registered (12%)',
        applicableTaxes: client.applicableTaxes || [
          'VAT (Form 2550Q)',
          'Compensation Withholding (Form 1601-C)',
          'Expanded Withholding (Form 0619-E / 1601-EQ)',
          'Corporate Income Tax (Form 1702-RT/EX)'
        ],
        managerInCharge: client.managerInCharge,
        healthStatus: client.healthStatus,
        contactPerson: client.contactPerson || '',
        contactEmail: client.contactEmail,
        contactPhone: client.contactPhone,
        registeredAddress: client.registeredAddress || '',
        accountingMethod: client.accountingMethod || 'Accrual Basis',
        fiscalYearEnd: client.fiscalYearEnd || 'Calendar Year (Dec 31)',
        subscribedServices: client.subscribedServices || [
          'Bookkeeping & General Ledger',
          'BIR Tax Filing & Compliance'
        ],
        notes: client.notes || ''
      });
    }
  }, [client]);

  // Email draft state
  const [emailPurpose, setEmailPurpose] = useState('Missing BIR 2307 Certificates & Monthly Sales Journal');
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copyEmailError, setCopyEmailError] = useState(false);

  // Filter tasks for this client
  const clientTasks = tasks.filter(t => t.clientName.toLowerCase() === client.name.toLowerCase());
  const flaggedTasks = clientTasks.filter(t => t.flagged);
  const openTasks = clientTasks.filter(t => t.status !== 'DONE');
  const clientDeadlines = deadlines.filter(d => d.clientId === client.id);
  const [generateMsg, setGenerateMsg] = useState('');

  const toggleApplicableTax = (taxName: string) => {
    setFormData(prev => {
      const exists = prev.applicableTaxes.includes(taxName);
      const updated = exists 
        ? prev.applicableTaxes.filter(t => t !== taxName)
        : [...prev.applicableTaxes, taxName];
      return { ...prev, applicableTaxes: updated };
    });
  };

  const toggleSubscribedService = (serviceName: string) => {
    setFormData(prev => {
      const exists = prev.subscribedServices.includes(serviceName);
      const updated = exists 
        ? prev.subscribedServices.filter(s => s !== serviceName)
        : [...prev.subscribedServices, serviceName];
      return { ...prev, subscribedServices: updated };
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateClientNotes(client.id, formData.notes, formData.healthStatus, formData);
    setIsSavedNotes(true);
    setTimeout(() => setIsSavedNotes(false), 2000);
  };

  const handleGenerateAiEmail = async () => {
    setIsDraftingEmail(true);
    setCopiedEmail(false);

    try {
      const response = await apiFetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_client_email',
          prompt: emailPurpose,
          context: {
            clientName: client.name,
            contactEmail: formData.contactEmail,
            contactPerson: formData.contactPerson,
            category: 'Tax Compliance Document Request'
          }
        })
      });

      const data = await response.json();
      if (data.success && data.text) {
        setGeneratedEmail(data.text);
      } else {
        setGeneratedEmail('Failed to draft email: ' + (data.error || 'Server error'));
      }
    } catch (err: any) {
      setGeneratedEmail('Error generating draft: ' + err.message);
    } finally {
      setIsDraftingEmail(false);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(generatedEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (err) {
      // Same reasoning as the AI Assistant modal's copy handler: clipboard
      // access can fail (permissions, insecure context), and writeText()
      // returns a rejectable promise specifically so that's detectable --
      // previously this wasn't awaited, so "Copied!" would show even when
      // nothing was actually copied.
      setCopyEmailError(true);
      setTimeout(() => setCopyEmailError(false), 2500);
    }
  };

  const getHealthBadge = (status: Client['healthStatus']) => {
    switch (status) {
      case 'Good':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'At Risk':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Needs Documents':
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        
        {/* Modal Header */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-extrabold tracking-tight">{client.name}</h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getHealthBadge(client.healthStatus)}`}>
                  {client.healthStatus}
                </span>
                {formData.taxRegistrationType && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                    {formData.taxRegistrationType}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>TIN: <strong className="text-slate-200 font-mono">{client.tin}</strong></span>
                <span>•</span>
                <span>{formData.rdoCode}</span>
                <span>•</span>
                <span>Industry: {client.industry}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDeleteClient && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete client account "${client.name}"?`)) {
                    onDeleteClient(client.id);
                    onClose();
                  }
                }}
                title="Delete Client Account"
                className="p-2 text-red-400 hover:text-white hover:bg-red-600/30 border border-red-500/30 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete Client</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Client Stats Quick Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-600 shrink-0">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Manager In Charge</span>
            <strong className="text-slate-800">{formData.managerInCharge}</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Open Filings</span>
            <strong className="text-slate-800">{openTasks.length} tasks</strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Flagged Roadblocks</span>
            <strong className={flaggedTasks.length > 0 ? 'text-red-600 font-bold' : 'text-slate-800'}>
              {flaggedTasks.length} issues
            </strong>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Active Tax Forms</span>
            <strong className="text-emerald-800 font-bold">{formData.applicableTaxes.length} BIR forms</strong>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 flex items-center gap-6 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('TASKS')}
            className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'TASKS'
                ? 'border-emerald-600 text-emerald-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Filing & Task History ({clientTasks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('DEADLINES')}
            className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'DEADLINES'
                ? 'border-emerald-600 text-emerald-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>Compliance Deadlines ({clientDeadlines.filter(d => d.status !== 'Completed').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('INFO')}
            className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'INFO'
                ? 'border-emerald-600 text-emerald-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4 text-teal-600" />
            <span>Tax Compliance & Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('EMAIL_GEN')}
            className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'EMAIL_GEN'
                ? 'border-emerald-600 text-emerald-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Draft Request Email</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/40">
          
          {/* TAB 1: TASKS & FILING HISTORY */}
          {activeTab === 'TASKS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tasks logged for {client.name}
                </h3>
                <button
                  onClick={() => {
                    onClose();
                    onSelectForBroadcast(client.name);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Broadcast New Task for Client</span>
                </button>
              </div>

              {clientTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  No task broadcasts recorded yet for this client.
                </div>
              ) : (
                <div className="space-y-3">
                  {clientTasks.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {t.category}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            t.status === 'DONE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {t.dueDate && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Due: {t.dueDate}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm">{t.title}</h4>
                      {t.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{t.description}</p>
                      )}

                      {t.flagged && t.flagReason && (
                        <div className="bg-red-50 text-red-900 text-xs p-2.5 rounded-xl border border-red-200 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span><strong>Roadblock:</strong> {t.flagReason}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPLIANCE DEADLINES (linked to this client) */}
          {activeTab === 'DEADLINES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Upcoming filings for {client.name}
                </h3>
                {onGenerateDeadlines && (
                  <button
                    onClick={() => {
                      const result = onGenerateDeadlines(client.id);
                      setGenerateMsg(
                        result.deadlinesCreated === 0 && result.tasksCreated === 0
                          ? 'Everything for the next 3 months is already on the calendar -- nothing new to add.'
                          : `Added ${result.deadlinesCreated} deadline(s) and ${result.tasksCreated} task(s) for the next 3 months.`
                      );
                      setTimeout(() => setGenerateMsg(''), 6000);
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate from BIR Calendar</span>
                  </button>
                )}
              </div>

              {generateMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                  {generateMsg}
                </div>
              )}

              {client.applicableTaxes && client.applicableTaxes.length > 0 ? (
                <p className="text-[11px] text-slate-500">
                  Based on this client's registered tax types ({client.applicableTaxes.join(', ')}). Local Business Tax and SSS/PhilHealth/Pag-IBIG deadlines vary by LGU/employer number and aren't auto-generated -- add those manually from Admin Hub.
                </p>
              ) : (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  This client has no registered tax types yet -- add some under the Tax Compliance & Profile tab so deadlines can be generated automatically.
                </p>
              )}

              {clientDeadlines.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  No deadlines recorded yet for this client.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...clientDeadlines].sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate)).map((d) => (
                    <div
                      key={d.id}
                      className={`bg-white p-3.5 rounded-2xl border shadow-2xs flex items-center justify-between gap-3 ${
                        d.status === 'Completed' ? 'border-slate-200 opacity-60' : 'border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900">{d.formCode} — {d.name}</div>
                        {d.description && <div className="text-[10px] text-slate-500 mt-0.5">{d.description}</div>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg ${
                          d.status === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {d.status === 'Completed' ? 'Filed' : `Due ${d.deadlineDate}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPREHENSIVE TAX PROFILE & EDITING */}
          {activeTab === 'INFO' && (
            <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
              
              {/* BIR Tax Types Checklist */}
              <div className="bg-teal-50/70 p-4 rounded-2xl border border-teal-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-teal-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-teal-700" />
                    Active BIR Tax Filing Obligations
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-200/70 text-teal-900">
                    {formData.applicableTaxes.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_TAX_TYPES.map((taxName, idx) => {
                    const isSelected = formData.applicableTaxes.includes(taxName);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleApplicableTax(taxName)}
                        className={`flex items-center gap-2 p-2 rounded-xl border font-semibold cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-teal-400'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-white text-teal-800 border-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{taxName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subscribed Retainer Services -- had full working state logic
                  (toggleSubscribedService) and was even saved to the backend,
                  but never actually had a UI section to interact with it. */}
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-700" />
                    Subscribed Retainer Services
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-900">
                    {formData.subscribedServices.length} Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_RETAINER_SERVICES.map((serviceName, idx) => {
                    const isSelected = formData.subscribedServices.includes(serviceName);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleSubscribedService(serviceName)}
                        className={`flex items-center gap-2 p-2 rounded-xl border font-semibold cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-indigo-700 text-white border-indigo-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-white text-indigo-800 border-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="truncate">{serviceName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Identity & RDO Registration */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-emerald-600" />
                  Tax Registration & District Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Registered Company Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Industry Sector</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">BIR TIN</label>
                    <input
                      type="text"
                      value={formData.tin}
                      onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">SEC / DTI Registration Number</label>
                    <input
                      type="text"
                      value={formData.secDtiNumber}
                      onChange={(e) => setFormData({ ...formData, secDtiNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Entity / Organization Structure</label>
                    <select
                      value={formData.entityType}
                      onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-medium"
                    >
                      {ENTITY_TYPES.map((type, i) => (
                        <option key={i} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Tax Registration Type (BIR)</label>
                    <select
                      value={formData.taxRegistrationType}
                      onChange={(e) => setFormData({ ...formData, taxRegistrationType: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-medium"
                    >
                      {TAX_REGISTRATION_TYPES.map((type, i) => (
                        <option key={i} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">BIR Revenue District Office (RDO)</label>
                  <select
                    value={formData.rdoCode}
                    onChange={(e) => setFormData({ ...formData, rdoCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-medium"
                  >
                    {COMMON_RDO_CODES.map((rdo, i) => (
                      <option key={i} value={rdo}>{rdo}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-600" />
                  Contact & Registered Address
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Contact Person</label>
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Contact Email</label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Contact Phone</label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Registered Principal Address</label>
                  <input
                    type="text"
                    value={formData.registeredAddress}
                    onChange={(e) => setFormData({ ...formData, registeredAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Status, Handler & Staff Notes */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  Account Status & Staff Audit Notes
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Account Health Status</label>
                    <select
                      value={formData.healthStatus}
                      onChange={(e) => setFormData({ ...formData, healthStatus: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-semibold"
                    >
                      <option value="Good">🟢 Good (All documents received & on-schedule)</option>
                      <option value="Needs Documents">🟡 Needs Documents (Pending receipts/2307s)</option>
                      <option value="At Risk">🔴 At Risk (Roadblocks or overdue risks)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-500 font-semibold mb-1 block">Assigned Staff Handler</label>
                    <input
                      type="text"
                      value={formData.managerInCharge}
                      onChange={(e) => setFormData({ ...formData, managerInCharge: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-semibold mb-1 block">Internal Engagement & Tax Audit Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Record special BIR tax mapping rules, preferred contact person, accounting software credentials, or audit nuances..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl h-24 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {isSavedNotes ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Client profile & tax preferences updated!</span>
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer shadow-sm"
                >
                  Save Tax Profile & Details
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: AI EMAIL DRAFT GENERATOR */}
          {activeTab === 'EMAIL_GEN' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/80 border border-emerald-200/90 p-4 rounded-2xl text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Gemini Staff Document & Reminder Draft Generator</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Generate professional BIR compliance emails formatted specifically for <strong>{client.name}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Request Subject / Purpose
                </label>
                <input
                  type="text"
                  value={emailPurpose}
                  onChange={(e) => setEmailPurpose(e.target.value)}
                  placeholder="e.g. Request for Q3 BIR 2307 Certificates and Inventory List"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleGenerateAiEmail}
                  disabled={isDraftingEmail || !emailPurpose}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  {isDraftingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Drafting with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Draft Email</span>
                    </>
                  )}
                </button>
              </div>

              {generatedEmail && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Generated Email Draft
                    </span>
                    <button
                      onClick={handleCopyEmail}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : copyEmailError ? (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy failed</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy to Clipboard</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-72 border border-slate-800">
                    {generatedEmail}
                  </pre>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
