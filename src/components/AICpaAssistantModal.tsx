import React, { useState } from 'react';
import { Task } from '../types';
import { 
  Sparkles, 
  Send, 
  Bot, 
  X, 
  FileCheck, 
  HelpCircle, 
  Loader2, 
  Copy, 
  Check,
  AlertCircle
} from 'lucide-react';

interface AICpaAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
}

export const AICpaAssistantModal: React.FC<AICpaAssistantModalProps> = ({
  isOpen,
  onClose,
  tasks,
}) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSendQuery = async (customPrompt?: string, actionType?: string) => {
    const queryToUse = customPrompt || prompt;
    if (!queryToUse && actionType !== 'feed_summary') return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType || 'general',
          prompt: queryToUse,
          context: { tasks }
        })
      });

      const data = await res.json();
      if (data.success && data.text) {
        setResponse(data.text);
      } else {
        setResponse('Error: ' + (data.error || 'Failed to get response'));
      }
    } catch (err: any) {
      setResponse('Connection error while contacting AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPrompts = [
    { label: 'Generate Manager Feed Summary', action: 'feed_summary', text: '' },
    { label: 'BIR 2550Q VAT Checklist', action: 'tax_checklist', text: 'BIR 2550Q VAT Return' },
    { label: 'Draft Client Email for Missing Docs', action: 'general', text: 'Draft a polite email to a client asking for missing official receipts and bank statements before tax deadline.' },
    { label: 'Withholding 1601-C Rules', action: 'tax_checklist', text: 'BIR 1601-C Withholding on Compensation' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
                <span>Gemini Senior CPA & Advisory Assistant</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  AI Powered
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Ask about BIR tax compliance, draft client notes, or summarize feed updates
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Chips */}
        <div className="py-3 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPrompt(p.text);
                handleSendQuery(p.text, p.action);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto py-3 my-1 space-y-4 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-xs font-medium">Consulting CPA knowledge base and compiling guidance...</p>
            </div>
          ) : response ? (
            <div className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700 space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2 text-xs font-bold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>CPA Advisory Report</span>
                </span>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] bg-slate-700/80 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-line font-sans">
                {response}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl p-6">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="font-semibold text-slate-300">Select a quick prompt above or type your question below.</p>
              <p className="text-slate-500 mt-1">
                e.g. "What supporting attachments are required for BIR 2550Q?" or "Draft a manager summary of all blocked tasks."
              </p>
            </div>
          )}
        </div>

        {/* Prompt Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="pt-3 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder="Type tax, BIR, or client accounting question..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 text-xs px-4 py-3 rounded-2xl border border-slate-700 focus:outline-none focus:border-emerald-500 transition"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </div>
    </div>
  );
};
