import React from 'react';
import { TaxDeadline } from '../types';
import { Calendar, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface TaxDeadlineTickerProps {
  deadlines: TaxDeadline[];
}

// Urgency is derived from the actual date rather than trusting whatever
// static `status` string was stored at creation time -- a deadline that was
// "Upcoming" a month ago should become visually urgent as it approaches
// without anyone having to remember to go update it by hand.
function isUrgentByDate(deadlineDate: string): boolean {
  const due = new Date(deadlineDate);
  if (isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
  return diffDays <= 7; // overdue or due within a week
}

export const TaxDeadlineTicker: React.FC<TaxDeadlineTickerProps> = ({ deadlines }) => {
  const visibleDeadlines = deadlines.filter((d) => d.status !== 'Completed');

  return (
    <div className="bg-slate-900 text-slate-100 border-b border-slate-800 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        
        {/* Ticker Title */}
        <div className="flex items-center gap-2 shrink-0 font-semibold text-emerald-400">
          <Calendar className="w-4 h-4" />
          <span className="uppercase tracking-wider text-[11px]">Tax Compliance Calendar</span>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">
            {visibleDeadlines.length} Active
          </span>
        </div>

        {/* Deadlines Scroll / Badges */}
        {visibleDeadlines.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            No upcoming deadlines configured. Add some in Admin Hub → Security → Tax Compliance Calendar.
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {visibleDeadlines.map((item) => {
              const isUrgent = isUrgentByDate(item.deadlineDate);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-medium shrink-0 transition ${
                    isUrgent
                      ? 'bg-red-950/60 border-red-500/40 text-red-200 animate-pulse'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-600'
                  }`}
                  title={item.description}
                >
                  {isUrgent ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="font-bold text-white">{item.formCode}</span>
                  <span className="text-slate-400 hidden sm:inline">•</span>
                  <span className="text-slate-300 text-[11px] hidden sm:inline">{item.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    isUrgent ? 'bg-red-500/30 text-red-100' : 'bg-slate-700 text-slate-200'
                  }`}>
                    Due {item.deadlineDate}
                  </span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

