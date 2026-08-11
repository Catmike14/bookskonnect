import React, { useState } from 'react';
import { User, Task } from '../types';
import { 
  Users, 
  UserCheck, 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Briefcase, 
  ChevronRight, 
  PlusCircle, 
  Filter,
  ShieldAlert,
  Layers,
  Calendar,
  Trash2
} from 'lucide-react';

interface TeamDirectoryProps {
  tasks: Task[];
  onSelectUserForBroadcast: (userName: string) => void;
  onFilterByAssignee: (userName: string) => void;
  users?: User[];
  onDeleteUser?: (userId: number) => void;
  currentUser?: User;
}

export const TeamDirectory: React.FC<TeamDirectoryProps> = ({
  tasks,
  onSelectUserForBroadcast,
  onFilterByAssignee,
  users = [],
  onDeleteUser,
  currentUser,
}) => {
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [searchMember, setSearchMember] = useState('');

  const filteredMembers = users.filter(u => 
    u.name.toLowerCase().includes(searchMember.toLowerCase()) ||
    u.role.toLowerCase().includes(searchMember.toLowerCase()) ||
    u.email.toLowerCase().includes(searchMember.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Search */}
      <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight">
              Accounting Team Directory & Workload
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Monitor team capacity, track active filings assigned to CPAs, and balance workload distribution.
            </p>
          </div>
        </div>

        {/* Member Search Bar */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search team member or role..."
            value={searchMember}
            onChange={(e) => setSearchMember(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>
      </div>

      {/* Team Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMembers.map((member) => {
          // Tasks assigned to this team member (or created by them)
          const assignedTasks = tasks.filter(t => 
            t.assignee?.name.toLowerCase() === member.name.toLowerCase() ||
            t.creator?.name.toLowerCase() === member.name.toLowerCase()
          );

          const openTasks = assignedTasks.filter(t => t.status !== 'DONE');
          const completedTasks = assignedTasks.filter(t => t.status === 'DONE');
          const flaggedTasks = assignedTasks.filter(t => t.flagged && t.status !== 'DONE');

          // Workload level styling based on open task count
          let workloadBadge = {
            label: `${openTasks.length} Open Tasks`,
            style: 'bg-emerald-100 text-emerald-800 border-emerald-300'
          };

          if (openTasks.length >= 4) {
            workloadBadge = {
              label: `${openTasks.length} Open (Heavy Workload)`,
              style: 'bg-red-100 text-red-800 border-red-300 font-extrabold'
            };
          } else if (openTasks.length >= 2) {
            workloadBadge = {
              label: `${openTasks.length} Open Tasks`,
              style: 'bg-amber-100 text-amber-800 border-amber-300'
            };
          }

          return (
            <div 
              key={member.id} 
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition duration-200 flex flex-col overflow-hidden"
            >
              {/* Member Card Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-2xs"
                    />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{member.name}</h3>
                      <span className="text-xs font-semibold text-slate-500 block">{member.role}</span>
                    </div>
                  </div>

                  {/* Workload Badge */}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${workloadBadge.style}`}>
                    {workloadBadge.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{member.email}</span>
                </div>
              </div>

              {/* Workload Stats Row */}
              <div className="grid grid-cols-3 border-b border-slate-100 divide-x divide-slate-100 text-center py-2.5 bg-white text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Open</span>
                  <strong className="text-slate-800 font-extrabold">{openTasks.length}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Completed</span>
                  <strong className="text-emerald-700 font-extrabold">{completedTasks.length}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Roadblocks</span>
                  <strong className={flaggedTasks.length > 0 ? 'text-red-600 font-extrabold' : 'text-slate-800'}>
                    {flaggedTasks.length}
                  </strong>
                </div>
              </div>

              {/* Assigned Tasks Summary List */}
              <div className="p-5 flex-1 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase font-extrabold text-slate-400 tracking-wider">
                  <span>Assigned Filings ({assignedTasks.length})</span>
                  {assignedTasks.length > 0 && (
                    <button
                      onClick={() => onFilterByAssignee(member.name)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold normal-case text-xs flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>View in Feed</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {assignedTasks.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 border border-slate-100">
                    No tasks currently assigned to this team member.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {assignedTasks.map((t) => (
                      <div 
                        key={t.id} 
                        className="p-2.5 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 truncate max-w-[170px]">{t.title}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${
                            t.status === 'DONE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-medium text-slate-600">{t.clientName}</span>
                          {t.dueDate && (
                            <span className="font-mono flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-slate-400" />
                              {t.dueDate}
                            </span>
                          )}
                        </div>

                        {t.flagged && t.flagReason && (
                          <div className="text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1 font-semibold">
                            <ShieldAlert className="w-3 h-3 text-red-600 shrink-0" />
                            <span className="truncate">{t.flagReason}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Action Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onFilterByAssignee(member.name)}
                  className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>Filter Feed</span>
                </button>

                <button
                  onClick={() => onSelectUserForBroadcast(member.name)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assign Task</span>
                </button>

                {onDeleteUser && currentUser?.role === 'System Administrator' && currentUser?.status === 'APPROVED' && member.role !== 'System Administrator' && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove team member "${member.name}"?`)) {
                        onDeleteUser(member.id);
                      }
                    }}
                    title="Remove Team Member Account"
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
