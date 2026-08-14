import React, { useState } from 'react';
import { User, Task, Client, Role, TaskStatus, UserStatus, DEFAULT_TAX_CATEGORIES } from '../types';
import { DeadlineManager } from './DeadlineManager';
import { changePassword } from '../utils/authClient';
import { apiFetch } from '../utils/apiFetch';
import { 
  ShieldCheck, 
  Users, 
  Database, 
  Trash2, 
  UserPlus, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  Search, 
  Check, 
  X,
  Lock,
  Layers,
  Sparkles,
  Shield,
  UserCheck,
  UserX,
  Clock,
  Tag,
  Plus,
  KeyRound
} from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  allUsers: User[];
  onUpdateUserRole: (userId: number, newRole: Role) => void;
  onUpdateUserStatus?: (userId: number, newStatus: UserStatus) => void;
  onDeleteUser: (userId: number) => void;
  onAddUser: (name: string, email: string, role: Role) => Promise<{ success: boolean; error?: string; tempPassword?: string }>;
  onResetUserPassword?: (userId: number) => Promise<{ success: boolean; error?: string; tempPassword?: string }>;
  tasks: Task[];
  clients: Client[];
  onDeleteTask: (taskId: number) => void;
  onForceUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onResetData: () => void;
  onRestoreData?: (importedData: { tasks?: Task[]; clients?: Client[]; users?: User[] }) => Promise<{ tasksRestored: number; clientsRestored: number; usersSkipped: boolean }> | void;
  aiEnabled?: boolean;
  onToggleAiEnabled?: (enabled: boolean) => void;
  deadlines?: import('../types').TaxDeadline[];
  onAddDeadline?: (deadline: Omit<import('../types').TaxDeadline, 'id'>) => void;
  onUpdateDeadline?: (id: number, fields: Partial<import('../types').TaxDeadline>) => void;
  onDeleteDeadline?: (id: number) => void;
  onGenerateDeadlines?: (clientId?: number) => { deadlinesCreated: number; tasksCreated: number; clientsCovered: number };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  allUsers,
  onUpdateUserRole,
  onUpdateUserStatus,
  onDeleteUser,
  onAddUser,
  onResetUserPassword,
  tasks,
  clients,
  onDeleteTask,
  onForceUpdateTaskStatus,
  onResetData,
  onRestoreData,
  aiEnabled = true,
  onToggleAiEnabled,
  deadlines = [],
  onAddDeadline,
  onUpdateDeadline,
  onDeleteDeadline,
  onGenerateDeadlines,
}) => {
  // Authorization Check: Only approved System Administrators are allowed
  if (currentUser.role !== 'System Administrator' || currentUser.status !== 'APPROVED') {
    return (
      <div className="bg-white p-8 rounded-3xl border border-amber-200 text-center max-w-lg mx-auto my-12 shadow-md space-y-4">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">System Admin Control Restricted</h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {currentUser.status === 'PENDING'
              ? `Your account (${currentUser.name} - ${currentUser.role}) is currently awaiting verification by a System Administrator.`
              : `Your assigned role (${currentUser.role}) does not have System Administrator authority.`}
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-full text-xs font-bold">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            Administrator Approval Required
          </span>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'USERS' | 'DATA' | 'TASKS' | 'AUDIT' | 'SECURITY'>('USERS');

  // Change-my-password (Security tab)
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Master Admin Registration Key -- the key itself is never fetched from
  // or displayed by the server; this input is write-only. Whether public
  // self-registration as admin is locked is the one piece of state we do
  // read back (it's not secret).
  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [adminRegLocked, setAdminRegLocked] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState('');

  // Custom Task Categories State
  const [adminCategories, setAdminCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('bk_task_categories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_TAX_CATEGORIES;
  });
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryMsg, setCategoryMsg] = useState('');

  React.useEffect(() => {
    apiFetch('/api/auth/admin-reg-status')
      .then(r => r.json())
      .then(data => {
        if (data.success && typeof data.locked === 'boolean') {
          setAdminRegLocked(data.locked);
        }
      })
      .catch(() => {});

    apiFetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setAdminCategories(data.categories);
          localStorage.setItem('bk_task_categories', JSON.stringify(data.categories));
        }
      })
      .catch(() => {});
  }, []);

  const handleAddCategoryAdmin = () => {
    if (!newCategoryInput.trim()) return;
    const name = newCategoryInput.trim();
    if (adminCategories.includes(name)) {
      setCategoryMsg('Task type already exists.');
      return;
    }
    const updated = [...adminCategories, name];
    setAdminCategories(updated);
    localStorage.setItem('bk_task_categories', JSON.stringify(updated));
    setNewCategoryInput('');
    setCategoryMsg(`Task type "${name}" added successfully.`);
    setTimeout(() => setCategoryMsg(''), 3000);
    apiFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).catch(() => {});
  };

  const handleDeleteCategoryAdmin = (nameToDelete: string) => {
    const updated = adminCategories.filter(c => c !== nameToDelete);
    setAdminCategories(updated);
    localStorage.setItem('bk_task_categories', JSON.stringify(updated));
    apiFetch(`/api/categories/${encodeURIComponent(nameToDelete)}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const handleSaveMasterKey = async (overrideLocked?: boolean) => {
    const targetLocked = overrideLocked !== undefined ? overrideLocked : adminRegLocked;
    const cleanKey = masterKeyInput.trim();
    if (cleanKey.length > 0 && cleanKey.length < 4) {
      setKeySaveMessage('Error: Master Key must be at least 4 characters long.');
      return;
    }
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(cleanKey ? { newKey: cleanKey } : {}),
          locked: targetLocked
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setKeySaveMessage(`Error: ${data.error || 'Failed to update security settings.'}`);
        return;
      }
      setAdminRegLocked(data.locked);
      setMasterKeyInput('');
      setKeySaveMessage('Security settings updated successfully!');
    } catch (err) {
      setKeySaveMessage('Error: Network error updating security settings.');
    }
    setTimeout(() => setKeySaveMessage(''), 4000);
  };

  const handleToggleAdminLock = (newLockedValue: boolean) => {
    handleSaveMasterKey(newLockedValue);
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeMessage('');
    if (newPasswordInput.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long.');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setPasswordChangeError('New password and confirmation do not match.');
      return;
    }
    const result = await changePassword(currentPasswordInput, newPasswordInput);
    if (!result.success) {
      setPasswordChangeError(result.error || 'Failed to change password.');
      return;
    }
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmNewPasswordInput('');
    setPasswordChangeMessage('Password updated successfully!');
    setTimeout(() => setPasswordChangeMessage(''), 4000);
  };
  
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
  const [newUserTempPassword, setNewUserTempPassword] = useState('');

  // Admin-initiated password reset (one-time reveal, same pattern as Add User)
  const [resetPasswordFor, setResetPasswordFor] = useState<User | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  const [generateResultMsg, setGenerateResultMsg] = useState('');
  const [restoreMsg, setRestoreMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const handleConfirmResetPassword = async () => {
    if (!onResetUserPassword || !resetPasswordFor) return;
    setResetPasswordError('');
    setResetPasswordSubmitting(true);
    const result = await onResetUserPassword(resetPasswordFor.id);
    setResetPasswordSubmitting(false);
    if (!result.success) {
      setResetPasswordError(result.error || 'Failed to reset password.');
      return;
    }
    setResetPasswordResult(result.tempPassword || '');
  };

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

  const handleAddUserSubmit = async (e: React.FormEvent) => {
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

    const result = await onAddUser(newName.trim(), newEmail.trim(), newRole);
    if (!result.success) {
      setNewUserError(result.error || 'Failed to create user.');
      return;
    }

    setNewUserTempPassword(result.tempPassword || '');
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
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (parsed.tasks || parsed.clients || parsed.users)) {
          if (onRestoreData) {
            const result = await onRestoreData(parsed);
            if (result) {
              const parts = [
                `${result.tasksRestored} task(s) restored`,
                `${result.clientsRestored} client(s) restored`,
              ];
              if (result.usersSkipped) {
                parts.push('users skipped (accounts now require real passwords -- use "Add User" instead)');
              }
              setRestoreMsg({ text: `Restore complete: ${parts.join(', ')}.`, isError: false });
            } else {
              setRestoreMsg({ text: 'Data restored successfully!', isError: false });
            }
          }
        } else {
          setRestoreMsg({ text: 'Invalid backup file format.', isError: true });
        }
      } catch (err) {
        setRestoreMsg({ text: 'Failed to parse backup JSON file.', isError: true });
      }
      setTimeout(() => setRestoreMsg(null), 6000);
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

        {restoreMsg && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold border ${
            restoreMsg.isError
              ? 'bg-red-950/60 border-red-500/40 text-red-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}>
            {restoreMsg.text}
          </div>
        )}

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
                <option value="Accounting Associate">Accounting Associate</option>
                <option value="Admin Officer">Admin Officer</option>
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
                            <option value="Accounting Associate">Accounting Associate</option>
                            <option value="Admin Officer">Admin Officer</option>
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

                              {onResetUserPassword && (
                                <button
                                  onClick={() => {
                                    setResetPasswordFor(u);
                                    setResetPasswordResult('');
                                    setResetPasswordError('');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Reset Password"
                                >
                                  <KeyRound className="w-4 h-4" />
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
            
            {/* AI CPA Assistant & Gemini Integration Control */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">AI CPA Assistant & Gemini Draft Controls</h3>
                  <p className="text-xs text-slate-500">Toggle visibility and access to AI Assistant modal & Gemini draft generator</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3">
                <div className="pr-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    AI CPA Assistant & Gemini Features
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      aiEnabled !== false
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {aiEnabled !== false ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {aiEnabled !== false
                      ? "AI CPA Assistant button in header and 'AI Draft with Gemini' button in broadcast posts are active for all users."
                      : "AI CPA Assistant button in header and 'AI Draft with Gemini' buttons are hidden across the entire application."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAiEnabled && onToggleAiEnabled(aiEnabled === false)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer shrink-0 ${
                    aiEnabled !== false ? 'bg-teal-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                  title={aiEnabled !== false ? "Disable AI CPA Assistant and Gemini Draft" : "Enable AI CPA Assistant and Gemini Draft"}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            {/* Change My Password */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Change My Password</h3>
                  <p className="text-xs text-slate-500">Update the password for your own account ({currentUser.email})</p>
                </div>
              </div>

              <form onSubmit={handleChangeOwnPassword} className="space-y-2.5">
                {passwordChangeError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                    {passwordChangeError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New</label>
                    <input
                      type="password"
                      value={confirmNewPasswordInput}
                      onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Update Password
                </button>
                {passwordChangeMessage && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold text-center">
                    {passwordChangeMessage}
                  </div>
                )}
              </form>
            </div>

            {/* Master Admin Registration Key Security */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">Admin Registration Control & Master Key</h3>
                  <p className="text-xs text-slate-500">Configure public registration rules and security passcodes for Administrators</p>
                </div>
              </div>

              {/* Toggle to Disable Public Admin Registration */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    Lock Public System Admin Registration
                    {adminRegLocked && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                        LOCKED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {adminRegLocked 
                      ? "Public users cannot select or claim System Administrator status on sign up. Admins must invite/add them internally."
                      : "Public sign ups can claim System Administrator role if they enter the Master Key below."}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleAdminLock(!adminRegLocked)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    adminRegLocked 
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700 shadow-xs' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {adminRegLocked ? 'Locked (Admin-Only)' : 'Public Registration Allowed'}
                </button>
              </div>

              {!adminRegLocked && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Set New Admin Master Passcode</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={masterKeyInput}
                      onChange={(e) => setMasterKeyInput(e.target.value)}
                      placeholder="Leave blank to keep the current key"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    For security, the current key is never displayed or sent to the browser. Enter a new one here to rotate it, or leave this blank and just use the lock toggle above.
                  </p>
                  <button
                    onClick={() => handleSaveMasterKey()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Update Admin Master Key
                  </button>
                </div>
              )}

              {keySaveMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-bold text-center border ${
                  keySaveMessage.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  {keySaveMessage}
                </div>
              )}
            </div>

            {/* Task Types & Custom Categories Configuration */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sm:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Custom Task Types & Compliance Services</h3>
                    <p className="text-xs text-slate-500">Configure global task types selectable across firm broadcasts & assignments</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">
                  {adminCategories.length} Active Categories
                </span>
              </div>

              {/* Add New Category Row */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategoryAdmin(); }}
                  placeholder="e.g., BIR Ruling Advisory, SEC Filing, Special Valuation..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                />
                <button
                  onClick={handleAddCategoryAdmin}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Task Type</span>
                </button>
              </div>

              {categoryMsg && (
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  {categoryMsg}
                </p>
              )}

              {/* Task Categories Grid */}
              <div className="flex flex-wrap gap-2 pt-2">
                {adminCategories.map((cat) => (
                  <div
                    key={cat}
                    className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold group transition"
                  >
                    <span>{cat}</span>
                    {!DEFAULT_TAX_CATEGORIES.includes(cat) && (
                      <button
                        onClick={() => handleDeleteCategoryAdmin(cat)}
                        title="Delete custom task type"
                        className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tax Compliance Calendar (Deadlines) Management */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 sm:col-span-2">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Tax Compliance Calendar (Deadlines)</h3>
                    <p className="text-xs text-slate-500">Feeds the ticker banner at the top of the app</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
                    {deadlines.length} Deadlines
                  </span>
                  {onGenerateDeadlines && (
                    <button
                      onClick={() => {
                        const result = onGenerateDeadlines();
                        setGenerateResultMsg(
                          `Generated ${result.deadlinesCreated} deadline(s) and ${result.tasksCreated} task(s) across ${result.clientsCovered} client(s). Already-existing entries for the same period were skipped.`
                        );
                        setTimeout(() => setGenerateResultMsg(''), 6000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-full shadow-xs transition cursor-pointer"
                      title="Generate upcoming deadlines and tasks for every client from their registered tax types"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate from BIR Calendar</span>
                    </button>
                  )}
                </div>
              </div>

              {generateResultMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold">
                  {generateResultMsg}
                </div>
              )}

              <p className="text-[11px] text-slate-500 -mt-1">
                Generates the next 3 months of deadlines (and a matching task per filing) from each client's registered tax types under Client Directory. Local Business Tax and SSS/PhilHealth/Pag-IBIG deadlines vary too much by LGU/employer number to auto-generate -- add those manually below.
              </p>

              <DeadlineManager
                deadlines={deadlines}
                clients={clients}
                onAdd={onAddDeadline}
                onUpdate={onUpdateDeadline}
                onDelete={onDeleteDeadline}
              />
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
                onClick={() => { setShowAddUserModal(false); setNewUserTempPassword(''); setNewUserError(''); }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newUserTempPassword ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Account created successfully
                  </div>
                  <p>Share this one-time temporary password with the new team member securely (not over the team feed). They should change it immediately after signing in via Admin Hub → Security → Change My Password.</p>
                  <div className="bg-white border border-emerald-300 rounded-lg px-3 py-2 font-mono text-sm font-bold text-slate-900 select-all">
                    {newUserTempPassword}
                  </div>
                </div>
                <button
                  onClick={() => { setShowAddUserModal(false); setNewUserTempPassword(''); }}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
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
                      placeholder="alex.m@gmail.com"
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
                      <option value="Accounting Associate">Accounting Associate</option>
                      <option value="Admin Officer">Admin Officer</option>
                      <option value="Bookkeeper">Bookkeeper</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    A secure temporary password will be generated and shown once on the next screen -- there's no need to set one here.
                  </p>

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
              </>
            )}
          </div>
        </div>
      )}

      {resetPasswordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Reset Password</span>
              </h3>
              <button
                onClick={() => setResetPasswordFor(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetPasswordResult ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Password reset for {resetPasswordFor.name}
                  </div>
                  <p>Their old password no longer works. Share this new temporary password securely (not over the team feed) -- they should change it via the account dropdown after signing in.</p>
                  <div className="bg-white border border-emerald-300 rounded-lg px-3 py-2 font-mono text-sm font-bold text-slate-900 select-all">
                    {resetPasswordResult}
                  </div>
                </div>
                <button
                  onClick={() => setResetPasswordFor(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  This will immediately invalidate <strong>{resetPasswordFor.name}</strong>'s current password and generate a new temporary one, shown here once.
                </p>
                {resetPasswordError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
                    {resetPasswordError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setResetPasswordFor(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmResetPassword}
                    disabled={resetPasswordSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {resetPasswordSubmitting ? 'Resetting…' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
