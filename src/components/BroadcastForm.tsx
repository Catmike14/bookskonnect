import React, { useState, useEffect } from 'react';
import { User, TaxCategory, Priority, Task, DEFAULT_TAX_CATEGORIES } from '../types';
import { INITIAL_CLIENTS } from '../data/initialData';
import { 
  Send, 
  Sparkles, 
  Flag, 
  PlusCircle, 
  AlertTriangle, 
  Calendar, 
  FileText, 
  Building,
  UserCheck,
  Tag,
  Loader2,
  Paperclip,
  X,
  FileCheck,
  Clock,
  Plus
} from 'lucide-react';

interface BroadcastFormProps {
  currentUser: User;
  allUsers?: User[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'auditLog' | 'reactions' | 'comments'>) => void;
}

export const BroadcastForm: React.FC<BroadcastFormProps> = ({ currentUser, allUsers = [], onAddTask }) => {
  const userList = allUsers.length > 0 ? allUsers : (currentUser ? [currentUser] : []);
  const [clientName, setClientName] = useState('');
  const [customClient, setCustomClient] = useState('');
  const [title, setTitle] = useState('');
  
  // Custom Task Types / Categories State
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('bk_task_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_TAX_CATEGORIES;
  });
  const [category, setCategory] = useState<string>('VAT 2550Q');
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          localStorage.setItem('bk_task_categories', JSON.stringify(data.categories));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveNewCustomCategory = () => {
    if (!customCategoryInput.trim()) return;
    const newCat = customCategoryInput.trim();
    if (!categories.includes(newCat)) {
      const updated = [...categories, newCat];
      setCategories(updated);
      localStorage.setItem('bk_task_categories', JSON.stringify(updated));
      fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCat })
      }).catch(() => {});
    }
    setCategory(newCat);
    setCustomCategoryInput('');
    setIsAddingCustomCategory(false);
  };
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [assigneeId, setAssigneeId] = useState<number>(currentUser?.id || (userList[0]?.id ?? 0));
  const [dueDate, setDueDate] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string; size: string }[]>([]);

  const [isDraftingAi, setIsDraftingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const finalClientName = clientName === 'OTHER' ? customClient : clientName;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    const newAtts = fileList.map((f: File) => ({
      name: f.name,
      url: '#',
      size: (f.size / 1024).toFixed(1) + ' KB'
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  };

  const handleAddSampleAttachment = (sampleName: string, size: string) => {
    setAttachments(prev => [...prev, { name: sampleName, url: '#', size }]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalClientName || !title) return;

    const selectedAssignee = userList.find(u => u.id === Number(assigneeId)) || currentUser;

    onAddTask({
      clientName: finalClientName,
      title,
      category,
      priority,
      dueDate: dueDate || undefined,
      description,
      status: 'OPEN',
      flagged: isFlagged,
      flagReason: isFlagged ? (flagReason || 'Roadblock requiring attention') : null,
      flagDate: isFlagged ? new Date().toISOString() : null,
      creator: currentUser,
      assignee: selectedAssignee,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    // Reset Form
    setTitle('');
    setDescription('');
    setIsFlagged(false);
    setFlagReason('');
    setAttachments([]);
    setAiError(null);
  };

  const handleGenerateAiDraft = async () => {
    if (!finalClientName && !title) {
      setAiError('Please fill in Client Name or Task Title first to give Gemini context.');
      return;
    }

    setIsDraftingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft_update',
          prompt: description,
          context: {
            clientName: finalClientName || 'Client',
            title: title || category,
            category
          }
        })
      });

      const data = await response.json();
      if (data.success && data.text) {
        setDescription(data.text);
      } else {
        setAiError(data.error || 'Failed to generate draft.');
      }
    } catch (err: any) {
      setAiError(err.message || 'Connection error.');
    } finally {
      setIsDraftingAi(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 md:p-6 lg:sticky lg:top-24">
      
      {/* Form Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm tracking-tight">Broadcast Team Update</h2>
            <p className="text-[11px] text-slate-500 font-medium">Post task status, client filings, or flag blockers</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Quick Recurring Tax Schedule Presets */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3 rounded-xl">
          <span className="block text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Automated Recurring Tax Schedules</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setTitle('Monthly 1601-C Compensation Withholding Filing');
                setCategory('BIR Tax Filing');
                setPriority('HIGH');
                const next10th = new Date();
                next10th.setMonth(next10th.getMonth() + 1);
                next10th.setDate(10);
                setDueDate(next10th.toISOString().split('T')[0]);
                setDescription('Automated monthly recurring compliance task: Collect payroll registers, verify SSS/PhilHealth/Pag-IBIG deductions, calculate 1601-C withholding, and prepare eFPS filing XML.');
              }}
              className="text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-lg transition cursor-pointer"
            >
              + 1601-C Monthly Withholding
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle('Quarterly 2550Q Value-Added Tax Reconciliation');
                setCategory('VAT Return');
                setPriority('URGENT');
                const next25th = new Date();
                next25th.setDate(25);
                setDueDate(next25th.toISOString().split('T')[0]);
                setDescription('Automated recurring VAT schedule: Reconcile official receipts, input/output VAT ledgers, verify summary list of sales/purchases (SLSP), and file Form 2550Q.');
              }}
              className="text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-lg transition cursor-pointer"
            >
              + 2550Q VAT Quarterly
            </button>
          </div>
        </div>
        
        {/* Client Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            Client Name *
          </label>
          <select
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-medium"
            required
          >
            <option value="">-- Select Client --</option>
            {INITIAL_CLIENTS.map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.industry})</option>
            ))}
            <option value="OTHER">+ Add Custom Client Name...</option>
          </select>

          {clientName === 'OTHER' && (
            <input
              type="text"
              placeholder="Enter Client Firm / Company Name..."
              value={customClient}
              onChange={(e) => setCustomClient(e.target.value)}
              className="mt-2 w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
              required
            />
          )}
        </div>

        {/* Task Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Task Title *
          </label>
          <input
            type="text"
            placeholder="e.g., Q2 Form 2550Q VAT Reconciliation"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-semibold"
            required
          />
        </div>

        {/* Category & Priority Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                Tax / Task Type
              </label>
              {!isAddingCustomCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingCustomCategory(true)}
                  className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  Custom
                </button>
              )}
            </div>

            {isAddingCustomCategory ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="New task type name..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-500 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveNewCustomCategory}
                    className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(false);
                      setCustomCategoryInput('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === 'CREATE_NEW_CUSTOM_TYPE') {
                    setIsAddingCustomCategory(true);
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-medium"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="CREATE_NEW_CUSTOM_TYPE">+ Add Custom Task Type...</option>
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-medium"
            >
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">🚨 Urgent</option>
            </select>
          </div>
        </div>

        {/* Assignee & Due Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-slate-400" />
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition font-medium"
            >
              {userList.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Target Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
            />
          </div>
        </div>

        {/* Details & Notes with AI Assist button */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Context & Instructions
            </label>
            <button
              type="button"
              onClick={handleGenerateAiDraft}
              disabled={isDraftingAi}
              className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
            >
              {isDraftingAi ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generating Draft...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>AI Draft with Gemini</span>
                </>
              )}
            </button>
          </div>

          <textarea
            placeholder="Provide context, input VAT status, receipt verification, or client notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition h-24 resize-none leading-relaxed"
          />

          {aiError && (
            <p className="text-[11px] text-red-600 mt-1 font-medium">{aiError}</p>
          )}
        </div>

        {/* File Attachments */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              Attachments (Workpapers & Receipts)
            </label>
            <label className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1">
              <span>+ Browse Files</span>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Quick Preset File Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <button
              type="button"
              onClick={() => handleAddSampleAttachment('VAT_Form_2550Q_Reconciliation.xlsx', '142.5 KB')}
              className="text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
            >
              + Add VAT Reconciliation (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleAddSampleAttachment('BIR_2307_Certificate.pdf', '88.0 KB')}
              className="text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
            >
              + Add BIR 2307 (.pdf)
            </button>
          </div>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-emerald-950 truncate">{att.name}</span>
                    <span className="text-[10px] text-emerald-700 font-mono shrink-0">({att.size})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="text-slate-400 hover:text-red-600 transition p-0.5 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flag Roadblock Toggle */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <Flag className={`w-4 h-4 ${isFlagged ? 'text-red-600 fill-red-600' : 'text-slate-400'}`} />
              <span className="text-xs font-bold text-slate-800">Flag as Roadblock / Blocker</span>
            </div>
            <input
              type="checkbox"
              checked={isFlagged}
              onChange={(e) => setIsFlagged(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
            />
          </label>

          {isFlagged && (
            <div className="pt-2 animate-in fade-in duration-150">
              <label className="block text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                Reason for Roadblock *
              </label>
              <input
                type="text"
                placeholder="e.g. Missing bank statements, delayed client sign-off, BIR eFPS server offline..."
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-red-50/50 border border-red-200 rounded-xl text-red-900 focus:bg-white focus:ring-2 focus:ring-red-500/20 outline-none transition"
                required={isFlagged}
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white py-3 rounded-xl text-xs font-bold shadow-md shadow-slate-900/10 transition cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Post Update to Team Feed</span>
          <Send className="w-3.5 h-3.5" />
        </button>

      </form>
    </div>
  );
};
