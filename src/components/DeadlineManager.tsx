import React, { useState } from 'react';
import { TaxDeadline } from '../types';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface DeadlineManagerProps {
  deadlines: TaxDeadline[];
  onAdd?: (deadline: Omit<TaxDeadline, 'id'>) => void;
  onUpdate?: (id: number, fields: Partial<TaxDeadline>) => void;
  onDelete?: (id: number) => void;
}

export const DeadlineManager: React.FC<DeadlineManagerProps> = ({ deadlines, onAdd, onUpdate, onDelete }) => {
  const [formCode, setFormCode] = useState('');
  const [name, setName] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    if (!formCode.trim() || !name.trim() || !deadlineDate) {
      setError('Form code, name, and a date are all required.');
      return;
    }
    onAdd?.({
      formCode: formCode.trim(),
      name: name.trim(),
      deadlineDate,
      description: description.trim(),
      status: 'Upcoming',
    });
    setFormCode('');
    setName('');
    setDeadlineDate('');
    setDescription('');
  };

  const sorted = [...deadlines].sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          type="text"
          value={formCode}
          onChange={(e) => setFormCode(e.target.value)}
          placeholder="Form Code (e.g. 2550Q)"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deadline Name"
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500 sm:col-span-2"
        />
        <input
          type="date"
          value={deadlineDate}
          onChange={(e) => setDeadlineDate(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Deadline</span>
        </button>
      </div>

      {error && (
        <p className="text-xs font-bold text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">No tax deadlines configured yet. Add one above to populate the calendar ticker.</p>
        ) : (
          sorted.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {d.formCode} — {d.name}
                </div>
                <div className="text-[10px] text-slate-500">{d.deadlineDate}{d.description ? ` · ${d.description}` : ''}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.status !== 'Completed' && onUpdate && (
                  <button
                    onClick={() => onUpdate(d.id, { status: 'Completed' })}
                    title="Mark completed"
                    className="p-1.5 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(d.id)}
                    title="Delete deadline"
                    className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
