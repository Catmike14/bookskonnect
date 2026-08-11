import React, { useState } from 'react';
import { User, Task, Client, Role, TaskStatus, UserStatus } from '../types';
import { 
  ShieldCheck, 
  Users, 
  Database, 
  Trash2, 
  UserPlus, 
  Edit3, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Search, 
  Sliders, 
  FileSpreadsheet, 
  Building2, 
  Check, 
  X,
  Lock,
  Layers,
  Sparkles,
  Shield,
  UserCheck,
  UserX,
  Clock
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  allUsers: User[];
  onUpdateUserRole: (userId: number, newRole: Role) => void;
  onUpdateUserStatus?: (userId: number, newStatus: UserStatus) => void;
  onDeleteUser: (userId: number) => void;
  onAddUser: (user: User) => void;
  tasks: Task[];
  clients: Client[];
  onDeleteTask: (taskId: number) => void;
  onForceUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onResetData: () => void;
  onRestoreData?: (importedData: { tasks?: Task[]; clients?: Client[]; users?: User[] }) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  allUsers,
  onUpdateUserRole,
  onUpdateUserStatus,
  onDeleteUser,
  onAddUser,
  tasks,
  clients,
  onDeleteTask,
  onForceUpdateTaskStatus,
  onResetData,
  onRestoreData,
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'DATA' | 'TASKS' | 'AUDIT' | 'SECURITY'>('USERS');
  
  // Security Policies State
  const [require2FA, setRequire2FA] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [adminPin, setAdminPin] = useState('8888');
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [pinChangeMessage, setPinChangeMessage] = useState('');
  
  // User Search & Filter
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New User Form Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('Senior CPA');
  const [newUserError, setNewUserError] = useState('');

  // Task Search
  const [taskSearch, setTaskSearch] = useState('');

  // Backup / Restore File Input
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const pendingUsersCount = allUsers.filter(u => (u.status || 'APPROVED') === 'PENDING').length;

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const userStatus = u.status || 'APPROVED';
    const matchesStatus = statusFilter === 'ALL' || userStatus === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.clientName.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.creator.name.toLowerCase().includes(taskSearch.toLowerCase())
  );

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError('');

    if (!newName.trim() || !newEmail.trim()) {
      setNewUserError('Please provide both name and email address.');
      return;
    }

    if (allUsers.some(u => u.email.toLowerCase() === newEmail.trim().toLowerCase())) {
      setNewUserError('An account with this email address already exists.');
      return;
    }

    const newUser: User = {
      id: Date.now(),
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      status: 'APPROVED',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newName)}`
    };

    onAddUser(newUser);
    setShowAddUserModal(false);
    setNewName('');
    setNewEmail('');
    setNewRole('Senior CPA');
  };

  const handleExportJSON = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser.name,
      users: allUsers,
      clients: clients,
      tasks: tasks,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookskonnect-admin-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (parsed.tasks || parsed.clients || parsed.users)) {
          if (onRestoreData) {
            onRestoreData(parsed);
            alert('Data restored successfully!');
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Compile all audit entries across tasks
  const allAuditLogs = tasks
    .flatMap(t => (t.auditLog || []).map(a => ({ ...a, taskTitle: t.title, clientName: t.clientName })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6">
      
      {/* Top Admin Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-900/50">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white">System Admin Control Hub</h2>
                <span className="bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Full Authority
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Logged in as <strong className="text-indigo-200">{currentUser.name}</strong> ({currentUser.email}). You have full administrative control over users, team roles, system state, backup/restore, and compliance feed moderation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Database</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Backup</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportJSON} 
              accept=".json" 
              className="hidden" 
            />
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-indigo-900/60">
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-indigo-900/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Registered Accounts</div>
            <div className="text-xl font-black text-indigo-300 mt-0.5">{allUsers.length}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-indigo-900/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active System Tasks</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{tasks.length}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-indigo-900/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Managed Corporate Clients</div>
            <div className="text-xl font-black text-amber-300 mt-0.5">{clients.length}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-indigo-900/40">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Audit Events</div>
            <div className="text-xl font-black text-cyan-300 mt-0.5">{allAuditLogs.length}</div>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'USERS', label: 'User & Role Management', icon: Users, badge: allUsers.length },
            { id: 'TASKS', label: 'Broadcast Content Moderation', icon: Layers, badge: tasks.length },
            { id: 'DATA', label: 'Storage & Backup Tools', icon: Database },
            { id: 'SECURITY', label: 'Security & Access Policies', icon: ShieldCheck },
            { id: 'AUDIT', label: 'Master System Audit Log', icon: Activity, badge: allAuditLogs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                    activeTab === tab.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: USERS & ROLES MANAGEMENT */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">

          {/* Pending Approval Alert Banner */}
          {pendingUsersCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-700 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Pending Account Approvals Required
                    <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-extrabold">
                      {pendingUsersCount}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {pendingUsersCount} new user registration request(s) are awaiting admin verification.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setStatusFilter('PENDING')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
                >
                  Filter Pending Users
                </button>
                {onUpdateUserStatus && (
                  <button
                    onClick={() => {
                      allUsers
                        .filter(u => (u.status || 'APPROVED') === 'PENDING')
                        .forEach(u => onUpdateUserStatus(u.id, 'APPROVED'));
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Approve All
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name or email..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            {/* Role & Status Filters & Add Button */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="System Administrator">System Administrator</option>
                <option value="Manager">Manager</option>
                <option value="Senior CPA">Senior CPA</option>
                <option value="Staff Auditor">Staff Auditor</option>
                <option value="Tax Specialist">Tax Specialist</option>
                <option value="Bookkeeper">Bookkeeper</option>
              </select>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add New Account</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">User Details</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role & Authority</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Change Role</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUsers.map((u) => {
                    const isAdmin = u.role === 'System Administrator';
                    const isSelf = u.id === currentUser.id;
                    const uStatus = u.status || 'APPROVED';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                            />
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                {u.name}
                                {isAdmin && (
                                  <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                                    <Shield className="w-3 h-3 text-indigo-600" />
                                    ADMIN
                                  </span>
                                )}
                                {isSelf && (
                                  <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">ID: #{u.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {u.email}
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            isAdmin 
                              ? 'bg-indigo-50 text-indigo-900 border border-indigo-200' 
                              : u.role === 'Manager'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {uStatus === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Active
                            </span>
                          ) : uStatus === 'PENDING' ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending Approval
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                              <UserX className="w-3.5 h-3.5 text-red-600" />
                              Rejected
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => onUpdateUserRole(u.id, e.target.value as Role)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="System Administrator">System Administrator</option>
                            <option value="Manager">Manager</option>
                            <option value="Senior CPA">Senior CPA</option>
                            <option value="Staff Auditor">Staff Auditor</option>
                            <option value="Tax Specialist">Tax Specialist</option>
                            <option value="Bookkeeper">Bookkeeper</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isSelf ? (
                            <span className="text-[10px] font-bold text-slate-400 italic">Protected Self</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {onUpdateUserStatus && uStatus === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => onUpdateUserStatus(u.id, 'APPROVED')}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                                    title="Approve User"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => onUpdateUserStatus(u.id, 'REJECTED')}
                                    className="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-200 hover:border-red-200 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                    title="Reject User"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Reject
                                  </button>
                                </>
                              )}

                              {onUpdateUserStatus && uStatus === 'APPROVED' && (
                                <button
                                  onClick={() => onUpdateUserStatus(u.id, 'PENDING')}
                                  className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-lg hover:bg-amber-100 transition cursor-pointer"
                                  title="Revoke Approval"
                                >
                                  Hold
                                </button>
                              )}

                              {onUpdateUserStatus && uStatus === 'REJECTED' && (
                                <button
                                  onClick={() => onUpdateUserStatus(u.id, 'APPROVED')}
                                  className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                                  title="Re-Approve User"
                                >
                                  Approve
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove account "${u.name}"?`)) {
                                    onDeleteUser(u.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATA & STORAGE TOOLS */}
      {activeTab === 'DATA' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Database Export & Import</h3>
                <p className="text-xs text-slate-500">Full JSON snapshot of all system states</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Export a complete backup containing all registered users, tasks, clients, and audit logs. You can re-import this JSON anytime to restore or synchronize between environments.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleExportJSON}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Backup (.json)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Restore Snapshot</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Emergency Reset & Maintenance</h3>
                <p className="text-xs text-slate-500">Hard reset to original demo data</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Reset all updates, clients, and accounts back to initial demo seeds. Useful for refreshing demo state or clearing test entries.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (confirm('WARNING: Are you sure you want to reset all application data to defaults?')) {
                    onResetData();
                  }
                }}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Hard Reset Data to Default</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BROADCAST & CONTENT MODERATION */}
      {activeTab === 'TASKS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search updates by title, client, author..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              Showing {filteredTasks.length} Broadcast Updates
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3 px-4">Broadcast Title & Category</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Author</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{t.title}</div>
                        <div className="text-[10px] text-slate-500">{t.category} • {t.priority}</div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800">
                        {t.clientName}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {t.creator.name}
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={t.status}
                          onChange={(e) => onForceUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="PENDING_REVIEW">PENDING REVIEW</option>
                          <option value="DONE">DONE</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Admin delete post: "${t.title}"?`)) {
                              onDeleteTask(t.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Force Delete Broadcast Post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & ACCESS CONTROL POLICIES */}
      {activeTab === 'SECURITY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Security Guard Controls */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Two-Factor Authentication (2FA)</h3>
                  <p className="text-xs text-slate-500">Require OTP verification on user sign-in</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <div className="text-xs font-bold text-slate-800">Mandatory 2FA OTP Security</div>
                  <div className="text-[10px] text-slate-500">Require 6-digit security code for all team accounts</div>
                </div>
                <button
                  onClick={() => setRequire2FA(!require2FA)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                    require2FA ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Auto Workstation Lock Timeout</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none cursor-pointer"
                >
                  <option value="15">15 Minutes of Inactivity</option>
                  <option value="30">30 Minutes of Inactivity</option>
                  <option value="60">60 Minutes of Inactivity</option>
                  <option value="NEVER">Never (Manual Lock Only)</option>
                </select>
              </div>
            </div>

            {/* Master Admin PIN Security */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Master Administrative Security PIN</h3>
                  <p className="text-xs text-slate-500">Authorization PIN for high-privilege actions</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Current Security PIN</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showAdminPin ? 'text' : 'password'}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                  <button
                    onClick={() => setShowAdminPin(!showAdminPin)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {showAdminPin ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setPinChangeMessage('Security PIN updated successfully!');
                  setTimeout(() => setPinChangeMessage(''), 3000);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                Save Security Settings
              </button>

              {pinChangeMessage && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold text-center">
                  {pinChangeMessage}
                </div>
              )}
            </div>

          </div>

          {/* Security Standards Summary */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md space-y-3">
            <h4 className="font-black text-sm text-indigo-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Platform Security Infrastructure Overview</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <div className="font-bold text-slate-200">Role-Based Access Control (RBAC)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Strict authority layers separating System Administrators, Managers, CPAs, and Auditors.</div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <div className="font-bold text-slate-200">Audit Trail Integrity</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Immutable audit logging tracking every compliance review, status transition, and roadblock event.</div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                <div className="font-bold text-slate-200">Session Isolation</div>
                <div className="text-[11px] text-slate-400 mt-0.5">User profile state persistence isolated with encrypted storage keys and quick profile switching.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MASTER AUDIT LOG */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">System Master Activity Trail</h3>
              <p className="text-xs text-slate-500">Real-time audit record of status updates, roadblock flags, and reviews</p>
            </div>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full">
              {allAuditLogs.length} Events Logged
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {allAuditLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <span>{log.user}</span>
                    <span className="text-[10px] text-slate-400 font-normal">• {new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-slate-600 font-medium">{log.action}</div>
                  <div className="text-[10px] text-indigo-600 font-bold">{log.clientName} — {log.taskTitle}</div>
                </div>
                <Activity className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Add User / Team Member</span>
              </h3>
              <button 
                onClick={() => setShowAddUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newUserError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {newUserError}
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name & Title</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Alex Morgan, CPA"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="alex.m@bookskonnect.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="System Administrator">System Administrator</option>
                  <option value="Manager">Manager</option>
                  <option value="Senior CPA">Senior CPA</option>
                  <option value="Staff Auditor">Staff Auditor</option>
                  <option value="Tax Specialist">Tax Specialist</option>
                  <option value="Bookkeeper">Bookkeeper</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
