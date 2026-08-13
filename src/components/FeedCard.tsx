import React, { useState } from 'react';
import { Task, TaskStatus, User } from '../types';
import { apiFetch } from '../utils/apiFetch';
import { 
  Clock, 
  Flag, 
  AlertTriangle, 
  AlertCircle,
  Calendar,
  MessageSquare, 
  Send, 
  User as UserIcon,
  CheckCircle2,
  Sparkles,
  History,
  FileText,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  Share2,
  ThumbsUp,
  Flame,
  Lightbulb,
  Loader2
} from 'lucide-react';

interface FeedCardProps {
  task: Task;
  currentUser: User;
  onUpdateStatus: (taskId: number, status: TaskStatus) => void;
  onToggleFlag: (taskId: number, currentFlagged: boolean, reason?: string) => void;
  onAddComment: (taskId: number, content: string) => void;
  onToggleReaction: (taskId: number, reactionType: string) => void;
}

export const FeedCard: React.FC<FeedCardProps> = ({
  task,
  currentUser,
  onUpdateStatus,
  onToggleFlag,
  onAddComment,
  onToggleReaction,
}) => {
  const [commentText, setCommentText] = useState('');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showAiStrategyModal, setShowAiStrategyModal] = useState(false);
  const [aiStrategyLoading, setAiStrategyLoading] = useState(false);
  const [aiStrategyContent, setAiStrategyContent] = useState<string | null>(null);

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(task.id, commentText.trim());
    setCommentText('');
  };

  const handleFlagClick = () => {
    if (task.flagged) {
      onToggleFlag(task.id, true);
    } else {
      const reason = prompt('Reason for flagging this roadblock (e.g. Missing supplier 2307, delayed client sign-off):');
      if (reason) {
        onToggleFlag(task.id, false, reason);
      }
    }
  };

  const handleRequestAiRoadblockStrategy = async () => {
    setShowAiStrategyModal(true);
    if (aiStrategyContent) return; // already loaded

    setAiStrategyLoading(true);
    try {
      const response = await apiFetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'roadblock_resolution',
          prompt: task.flagReason || 'Delayed task progress',
          context: {
            clientName: task.clientName,
            title: task.title,
            category: task.category
          }
        })
      });
      const data = await response.json();
      if (data.success && data.text) {
        setAiStrategyContent(data.text);
      } else {
        setAiStrategyContent('Unable to generate strategy at this time.');
      }
    } catch (err: any) {
      setAiStrategyContent('Error connecting to AI assistant.');
    } finally {
      setAiStrategyLoading(false);
    }
  };

  const getStatusStyle = (status: TaskStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PENDING_REVIEW':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'DONE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800 border-red-200 font-bold';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200 font-semibold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 font-medium';
    }
  };

  const acknowledgedUsers = task.reactions?.acknowledged || [];
  const hasUserAcknowledged = acknowledgedUsers.includes(currentUser.name);

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md overflow-hidden ${
      task.flagged ? 'border-red-300 ring-2 ring-red-500/10' : 'border-slate-200/80'
    }`}>
      
      {/* Card Header Top */}
      <div className="p-5 md:p-6 pb-4">
        
        {/* User Info & Client Badge */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <img
              src={task.creator.avatar}
              alt={task.creator.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">{task.creator.name}</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold border border-slate-200">
                  {task.creator.role}
                </span>
                {task.assignee && (
                  <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                    → assigned to <strong className="text-slate-800">{task.assignee.name}</strong>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {new Date(task.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>
          </div>

          {/* Right Badges & Flag Button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl border bg-slate-50 text-slate-800 border-slate-200 shadow-2xs">
              {task.clientName}
            </span>
            
            <button
              onClick={handleFlagClick}
              title={task.flagged ? 'Click to unflag roadblock' : 'Flag as Roadblock'}
              className={`p-2 rounded-xl border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                task.flagged
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <Flag className={`w-3.5 h-3.5 ${task.flagged ? 'fill-red-600 text-red-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Task Category Tag, Priority & Due Date / Overdue Indicator */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            {task.category}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md border uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
            {task.priority} Priority
          </span>
          {task.dueDate && (() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const isOverdue = task.status !== 'DONE' && task.dueDate < todayStr;
            
            return isOverdue ? (
              <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Overdue: {task.dueDate}</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-600 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Due: {task.dueDate}</span>
              </span>
            );
          })()}
        </div>

        {/* Title & Description */}
        <div className="mt-2">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{task.title}</h3>
          {task.description && (
            <p className="text-xs md:text-sm text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">
              {task.description}
            </p>
          )}
        </div>

        {/* Attachments if any */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {task.attachments.map((att, i) => {
              const hasValidLink = att.url && att.url !== '#';
              return (
                <a
                  key={i}
                  href={hasValidLink ? att.url : undefined}
                  download={hasValidLink ? att.name : undefined}
                  target={hasValidLink ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!hasValidLink) {
                      e.preventDefault();
                    }
                  }}
                  className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    hasValidLink 
                      ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800 cursor-pointer' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                  title={hasValidLink ? `Click to download ${att.name}` : att.name}
                >
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <span>{att.name}</span>
                  {att.size && <span className="text-[10px] opacity-70">({att.size})</span>}
                  {hasValidLink && <Download className="w-3 h-3 text-emerald-600 ml-0.5 shrink-0" />}
                </a>
              );
            })}
          </div>
        )}

        {/* Roadblock Warning Banner */}
        {task.flagged && task.flagReason && (
          <div className="mt-4 bg-red-50/90 border border-red-200 text-red-900 text-xs p-3.5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-950 block text-xs">Roadblock Flagged:</strong>
                <span className="text-red-800 text-xs">{task.flagReason}</span>
              </div>
            </div>

            <button
              onClick={handleRequestAiRoadblockStrategy}
              className="bg-white hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>AI Resolver Strategy</span>
            </button>
          </div>
        )}

        {/* AI Strategy Advice Modal / Box */}
        {showAiStrategyModal && (
          <div className="mt-3 bg-slate-900 text-slate-100 p-4 rounded-2xl text-xs border border-slate-800 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Gemini CPA Roadblock Resolution Plan</span>
              </div>
              <button 
                onClick={() => setShowAiStrategyModal(false)}
                className="text-slate-400 hover:text-white font-bold px-1"
              >
                ✕
              </button>
            </div>

            {aiStrategyLoading ? (
              <div className="flex items-center gap-2 py-4 text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Analyzing BIR compliance guidelines and drafting client resolution strategy...</span>
              </div>
            ) : (
              <div className="leading-relaxed whitespace-pre-line text-slate-200 font-sans">
                {aiStrategyContent}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Card Footer / Status & Reactions */}
      <div className="bg-slate-50/80 border-t border-slate-100 px-5 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Status Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
          <select
            value={task.status}
            onChange={(e) => onUpdateStatus(task.id, e.target.value as TaskStatus)}
            className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border outline-none cursor-pointer transition shadow-2xs ${getStatusStyle(task.status)}`}
          >
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="DONE">Done ✅</option>
          </select>
        </div>

        {/* Reactions & Audit Trail Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Reaction Acknowledge Button */}
          <button
            onClick={() => onToggleReaction(task.id, 'acknowledged')}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              hasUserAcknowledged
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Acknowledged</span>
            {acknowledgedUsers.length > 0 && (
              <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {acknowledgedUsers.length}
              </span>
            )}
          </button>

          {/* Audit History Toggle */}
          <button
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Audit Log ({task.auditLog.length})</span>
            {showAuditLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Comments count */}
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>{task.comments.length} comments</span>
          </div>

        </div>

      </div>

      {/* Audit Log Drawer */}
      {showAuditLog && (
        <div className="bg-slate-100/80 border-t border-slate-200/80 px-5 md:px-6 py-3 text-xs space-y-1.5">
          <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
            Activity Audit History
          </div>
          {task.auditLog.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-slate-600 text-[11px]">
              <span><strong>{log.user}</strong>: {log.action}</span>
              <span className="text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}

      {/* Comments Section */}
      <div className="bg-slate-50/40 border-t border-slate-100 px-5 md:px-6 py-4 space-y-3">
        {task.comments.length > 0 && (
          <div className="space-y-2.5">
            {task.comments.map((c) => (
              <div key={c.id} className="text-xs bg-white p-3 rounded-2xl border border-slate-200/70 shadow-2xs flex gap-3 items-start">
                <img
                  src={c.user.avatar}
                  alt={c.user.name}
                  className="w-7 h-7 rounded-full object-cover mt-0.5 border border-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{c.user.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-normal">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment Input Form */}
        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder={`Reply as ${currentUser.name}...`}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
          />
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1"
          >
            <span>Post</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>

    </div>
  );
};
