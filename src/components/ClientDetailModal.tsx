import React, { useState } from 'react';
import { Client, Task, TaskStatus } from '../types';
import { 
  X, 
  Building2, 
  Mail, 
  Phone, 
  UserCheck, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  PlusCircle, 
  Copy, 
  Check,
  Loader2,
  Calendar,
  Trash2
} from 'lucide-react';

interface ClientDetailModalProps {
  client: Client | null;
  tasks: Task[];
  onClose: () => void;
  onUpdateClientNotes: (clientId: number, newNotes: string, newHealth?: Client['healthStatus']) => void;
  onSelectForBroadcast: (clientName: string) => void;
  onDeleteClient?: (clientId: number) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  tasks,
  onClose,
  onUpdateClientNotes,
  onSelectForBroadcast,
  onDeleteClient,
}) => {
  if (!client) return null;

  const [activeTab, setActiveTab] = useState<'TASKS' | 'INFO' | 'EMAIL_GEN'>('TASKS');
  const [notesText, setNotesText] = useState(client.notes || '');
  const [healthStatus, setHealthStatus] = useState(client.healthStatus);
  const [isSavedNotes, setIsSavedNotes] = useState(false);

  // Email draft state
  const [emailPurpose, setEmailPurpose] = useState('Missing BIR 2307 Certificates & Sales Journal');
  const [isDraftingEmail, setIsDraftingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Filter tasks for this client
  const clientTasks = tasks.filter(t => t.clientName.toLowerCase() === client.name.toLowerCase());
  const flaggedTasks = clientTasks.filter(t => t.flagged);
  const openTasks = clientTasks.filter(t => t.status !== 'DONE');

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateClientNotes(client.id, notesText, healthStatus);
    setIsSavedNotes(true);
    setTimeout(() => setIsSavedNotes(false), 2000);
  };

  const handleGenerateAiEmail = async () => {
    setIsDraftingEmail(true);
    setCopiedEmail(false);

    try {
      const response = await fetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_client_email',
          prompt: emailPurpose,
          context: {
            clientName: client.name,
            contactEmail: client.contactEmail,
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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
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
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>TIN: <strong className="text-slate-200 font-mono">{client.tin}</strong></span>
                <span>•</span>
                <span>Industry: {client.industry}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDeleteClient && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to permanently delete the client account "${client.name}"? This action cannot be undone.`)) {
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
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-600">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Manager In Charge</span>
            <strong className="text-slate-800">{client.managerInCharge}</strong>
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
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Contact Person</span>
            <strong className="text-slate-800">{client.contactEmail}</strong>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 flex items-center gap-6 text-xs font-bold">
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
            onClick={() => setActiveTab('INFO')}
            className={`py-3.5 border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'INFO'
                ? 'border-emerald-600 text-emerald-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Client Notes & Details</span>
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

          {/* TAB 2: CLIENT INFO & NOTES */}
          {activeTab === 'INFO' && (
            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <label className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">Email Address</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contactEmail}</span>
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 uppercase font-semibold text-[10px] block mb-1">Phone Contact</label>
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.contactPhone}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Filing Health Status
                </label>
                <select
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value as Client['healthStatus'])}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-semibold text-slate-800"
                >
                  <option value="Good">🟢 Good (All documents received & on-schedule)</option>
                  <option value="Needs Documents">🟡 Needs Documents (Waiting on client receipts/vouchers)</option>
                  <option value="At Risk">🔴 At Risk (Overdue deadlines or unhandled roadblocks)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Internal Engagement & Special Audit Notes
                </label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Record special BIR tax mapping rules, preferred contact person, accounting software credentials, or audit nuances..."
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl h-32 outline-none focus:ring-2 focus:ring-emerald-500/20 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {isSavedNotes ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Client notes updated!</span>
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Save Notes & Health Status
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
                  <span>Gemini CPA Document & Reminder Draft Generator</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Automatically draft formal emails to {client.name} requesting missing accounting records, BIR certificates, or tax payment confirmations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Request Purpose / Specific Missing Documents
                </label>
                <input
                  type="text"
                  value={emailPurpose}
                  onChange={(e) => setEmailPurpose(e.target.value)}
                  placeholder="e.g. BIR 2307 Withholding Tax Certificates Q2, Sales Invoice Ledger, Bank Statement July 2026"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              <button
                onClick={handleGenerateAiEmail}
                disabled={isDraftingEmail}
                className="w-full bg-teal-800 hover:bg-teal-900 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDraftingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini is Drafting Formal Email...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Draft Client Request Email</span>
                  </>
                )}
              </button>

              {generatedEmail && (
                <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs space-y-3 relative border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono text-[10px] text-slate-400">TO: {client.contactEmail}</span>
                    <button
                      onClick={handleCopyEmail}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {copiedEmail ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Draft</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="whitespace-pre-line leading-relaxed font-sans text-slate-200">
                    {generatedEmail}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
