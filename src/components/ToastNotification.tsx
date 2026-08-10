import React, { useEffect, useState } from 'react';
import { Task } from '../types';
import { Bell, AlertTriangle, AlertCircle, Calendar, X, ExternalLink, CheckCircle } from 'lucide-react';

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type: 'overdue' | 'approaching' | 'info' | 'success';
  taskId?: number;
  dateStr?: string;
}

interface ToastNotificationProps {
  toasts: ToastAlert[];
  onDismiss: (id: string) => void;
  onSelectTask?: (taskId: number) => void;
}

export const ToastNotificationContainer: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss,
  onSelectTask,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-2 sm:px-0">
      
      {/* Notification Permission Request Banner if not granted */}
      {permission === 'default' && (
        <div className="pointer-events-auto bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
            <span>Enable browser push alerts for tax due date reminders?</span>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 text-[11px]"
          >
            Enable
          </button>
        </div>
      )}

      {/* Stack of Toast Banners */}
      {toasts.map((toast) => {
        const isOverdue = toast.type === 'overdue';
        const isApproaching = toast.type === 'approaching';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl p-4 shadow-2xl border transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${
              isOverdue
                ? 'bg-red-950/95 text-red-100 border-red-500/50 shadow-red-950/40'
                : isApproaching
                ? 'bg-amber-950/95 text-amber-100 border-amber-500/50 shadow-amber-950/40'
                : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {isOverdue ? (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : isApproaching ? (
                  <Calendar className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}

                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <span>{toast.title}</span>
                    {toast.dateStr && (
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-semibold">
                        {toast.dateStr}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-200/90 mt-1 leading-relaxed">
                    {toast.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {toast.taskId && onSelectTask && (
              <div className="mt-2.5 pt-2 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => {
                    onSelectTask(toast.taskId!);
                    onDismiss(toast.id);
                  }}
                  className="text-[11px] font-bold text-white hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Filter this task</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
};
