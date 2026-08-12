import React, { useState, useEffect } from 'react';
import { User, Task, TaskStatus, Client, TaxDeadline, Role } from './types';
import { INITIAL_CLIENTS, INITIAL_DEADLINES, INITIAL_TASKS } from './data/initialData';
import { Header } from './components/Header';
import { TaxDeadlineTicker } from './components/TaxDeadlineTicker';
import { BroadcastForm } from './components/BroadcastForm';
import { FeedCard } from './components/FeedCard';
import { ClientDirectory } from './components/ClientDirectory';
import { ComplianceAnalytics } from './components/ComplianceAnalytics';
import { TeamDirectory } from './components/TeamDirectory';
import { AdminPanel } from './components/AdminPanel';
import { AICpaAssistantModal } from './components/AICpaAssistantModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { ToastNotificationContainer, ToastAlert } from './components/ToastNotification';
import { fetchCurrentUser, logout as authLogout } from './utils/authClient';
import { apiFetch } from './utils/apiFetch';
import { 
  Inbox, 
  Filter, 
  Layers, 
  RefreshCw, 
  Sparkles, 
  ShieldAlert,
  Building2,
  CheckCircle2,
  Bell
} from 'lucide-react';

export default function App() {
  // Local cache of the registered-users list (for dropdowns, Team Directory,
  // etc.) -- purely a display cache. It carries no authority: who you
  // actually are is determined solely by the server-side session (see
  // currentUser / the auth bootstrap effect below), never by anything read
  // from localStorage.
  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('bk_registered_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('bk_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('bk_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [deadlines, setDeadlines] = useState<TaxDeadline[]>(INITIAL_DEADLINES);

  // Ask the server who the current session cookie belongs to. This is the
  // only source of truth for "who am I" -- there is no client-side login
  // state that isn't backed by a real, server-verified session.
  useEffect(() => {
    let isMounted = true;
    fetchCurrentUser().then((user) => {
      if (isMounted) {
        setCurrentUser(user);
        setIsCheckingSession(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Load the tax compliance calendar. Works whether or not a database is
  // configured (the server keeps an in-memory fallback list either way).
  useEffect(() => {
    apiFetch('/api/deadlines')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.deadlines)) {
          setDeadlines(data.deadlines);
        }
      })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<'FEED' | 'CLIENTS' | 'ANALYTICS' | 'TEAM' | 'ADMIN'>('FEED');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  // AI CPA Assistant & Gemini Features Enable/Disable State
  const [aiEnabled, setAiEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('bk_ai_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAiEnabled = (enabled: boolean) => {
    setAiEnabled(enabled);
    localStorage.setItem('bk_ai_enabled', String(enabled));
  };

  // State for PostgreSQL connectivity badge
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  // Bootstrap from API on mount
  useEffect(() => {
    let isMounted = true;
    async function loadBootstrap() {
      try {
        const res = await apiFetch('/api/bootstrap');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.dbConnected) {
            setDbConnected(true);
            setAllUsers(data.users || []);
            setClients(data.clients || []);
            setTasks(data.tasks || []);
          }
        }
      } catch (err) {
        // Fallback to localStorage
      }
    }
    loadBootstrap();
    return () => { isMounted = false; };
  }, []);

  // Admin Management Handlers -- these all hit admin-only server routes.
  // Local state is only updated after the server confirms success; if the
  // request is rejected (401/403 because the caller isn't really an admin)
  // we surface that instead of silently pretending it worked.
  const handleUpdateUserRole = async (userId: number, newRole: Role) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToasts(prev => [{ id: 'err-role-' + Date.now(), title: '🚫 Update Failed', message: data.error || 'Could not update role.', type: 'overdue' }, ...prev]);
        return;
      }
      setAllUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, role: newRole } : null));
      }
    } catch (e) {
      setToasts(prev => [{ id: 'err-role-' + Date.now(), title: '🚫 Update Failed', message: 'Network error updating role.', type: 'overdue' }, ...prev]);
    }
  };

  const handleUpdateUserStatus = async (userId: number, newStatus: import('./types').UserStatus) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToasts(prev => [{ id: 'err-status-' + Date.now(), title: '🚫 Update Failed', message: data.error || 'Could not update status.', type: 'overdue' }, ...prev]);
        return;
      }
      setAllUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: newStatus } : u)));
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(prev => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (e) {
      setToasts(prev => [{ id: 'err-status-' + Date.now(), title: '🚫 Update Failed', message: 'Network error updating status.', type: 'overdue' }, ...prev]);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setToasts(prev => [{ id: 'err-deluser-' + Date.now(), title: '🚫 Delete Failed', message: data.error || 'Could not delete user.', type: 'overdue' }, ...prev]);
        return;
      }
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      setToasts(prev => [{ id: 'err-deluser-' + Date.now(), title: '🚫 Delete Failed', message: 'Network error deleting user.', type: 'overdue' }, ...prev]);
    }
  };

  // Admin Hub "Add User" -- provisions an account directly with a generated
  // temporary password, returned once so the admin can relay it to the new
  // hire out-of-band. The new hire should change it after first login.
  const handleAdminCreateUser = async (name: string, email: string, role: Role): Promise<{ success: boolean; error?: string; tempPassword?: string }> => {
    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to create user.' };
      }
      setAllUsers(prev => [...prev, data.user]);
      return { success: true, tempPassword: data.tempPassword };
    } catch (e) {
      return { success: false, error: 'Network error creating user.' };
    }
  };

  const handleDeleteTask = (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' }).catch(() => {});
  };

  // Tax Deadline (Compliance Calendar) handlers
  const handleAddDeadline = async (deadline: Omit<TaxDeadline, 'id'>) => {
    try {
      const res = await apiFetch('/api/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deadline)
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.deadline) {
        setDeadlines(prev => [...prev, data.deadline]);
      }
    } catch (e) {}
  };

  const handleUpdateDeadline = async (id: number, fields: Partial<TaxDeadline>) => {
    setDeadlines(prev => prev.map(d => (d.id === id ? { ...d, ...fields } : d)));
    apiFetch(`/api/deadlines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    }).catch(() => {});
  };

  const handleDeleteDeadline = async (id: number) => {
    setDeadlines(prev => prev.filter(d => d.id !== id));
    apiFetch(`/api/deadlines/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleRestoreData = (importedData: { tasks?: Task[]; clients?: Client[]; users?: User[] }) => {
    if (importedData.tasks) setTasks(importedData.tasks);
    if (importedData.clients) setClients(importedData.clients);
    if (importedData.users) setAllUsers(importedData.users);
  };

  // Persist the display-only registered-users cache (not an auth source)
  useEffect(() => {
    localStorage.setItem('bk_registered_users', JSON.stringify(allUsers));
  }, [allUsers]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setAllUsers(prev => {
      if (prev.some(u => u.id === user.id)) {
        return prev.map(u => (u.id === user.id ? user : u));
      }
      return [...prev, user];
    });
    setIsAuthModalOpen(false);
    setToasts(prev => [
      {
        id: 'auth-' + Date.now(),
        title: '✅ Authenticated',
        message: `Welcome back, ${user.name}! Active role set to ${user.role}.`,
        type: 'approaching',
        dateStr: new Date().toLocaleDateString()
      },
      ...prev
    ]);
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    setIsAuthModalOpen(false);
    setToasts(prev => [
      {
        id: 'logout-' + Date.now(),
        title: '👋 Signed Out',
        message: 'You have been signed out. Please sign in or register to continue.',
        type: 'approaching',
        dateStr: new Date().toLocaleDateString()
      },
      ...prev
    ]);
  };

  // Check for approaching and overdue due dates on mount & task updates
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newToasts: ToastAlert[] = [];

    tasks.forEach((t) => {
      if (t.status === 'DONE' || !t.dueDate) return;

      if (t.dueDate < todayStr) {
        newToasts.push({
          id: 'overdue-' + t.id,
          title: '🚨 Overdue Tax Filing',
          message: `Task "${t.title}" for ${t.clientName} was due on ${t.dueDate}.`,
          type: 'overdue',
          taskId: t.id,
          dateStr: t.dueDate
        });
      } else {
        // Check if due within 14 days
        const dueDateObj = new Date(t.dueDate);
        const todayObj = new Date(todayStr);
        const diffDays = Math.ceil((dueDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays <= 14 && diffDays >= 0) {
          newToasts.push({
            id: 'approaching-' + t.id,
            title: '⏰ Approaching Due Date',
            message: `Task "${t.title}" for ${t.clientName} is due in ${diffDays === 0 ? 'today' : diffDays + ' days'}.`,
            type: 'approaching',
            taskId: t.id,
            dateStr: t.dueDate
          });
        }
      }
    });

    setToasts(newToasts.slice(0, 3)); // show top 3 alerts

    // Trigger browser notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      newToasts.forEach((toast) => {
        try {
          new Notification(toast.title, {
            body: toast.message,
            icon: '/favicon.ico'
          });
        } catch (e) {
          // ignore if restricted by iframe
        }
      });
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('bk_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('bk_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    if (activeTab === 'ADMIN' && (currentUser?.role !== 'System Administrator' || currentUser?.status !== 'APPROVED')) {
      setActiveTab('FEED');
      setToasts(prev => [
        {
          id: 'access-denied-' + Date.now(),
          title: '🚫 Access Restricted',
          message: 'Only verified System Administrators can access the System Admin Control Hub.',
          type: 'overdue'
        },
        ...prev
      ]);
    }
  }, [currentUser, activeTab]);

  // Handlers
  const syncTaskApi = (task: Task) => {
    apiFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    }).catch(() => {});
  };

  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'auditLog' | 'reactions' | 'comments'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      reactions: { 'acknowledged': [currentUser.name] },
      auditLog: [
        {
          id: 'log-' + Date.now(),
          timestamp: new Date().toISOString(),
          user: currentUser.name,
          action: 'Created task broadcast'
        }
      ]
    };

    setTasks([newTask, ...tasks]);
    syncTaskApi(newTask);
  };

  const handleUpdateStatus = (taskId: number, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated = {
          ...t,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          auditLog: [
            ...t.auditLog,
            {
              id: 'log-' + Date.now(),
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              action: `Changed status to ${newStatus}`
            }
          ]
        };
        syncTaskApi(updated);
        return updated;
      }
      return t;
    }));
  };

  const handleToggleFlag = (taskId: number, currentFlagged: boolean, reason?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextFlagState = !currentFlagged;
        const updated = {
          ...t,
          flagged: nextFlagState,
          flagReason: nextFlagState ? (reason || 'Roadblock requiring attention') : null,
          flagDate: nextFlagState ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
          auditLog: [
            ...t.auditLog,
            {
              id: 'log-' + Date.now(),
              timestamp: new Date().toISOString(),
              user: currentUser.name,
              action: nextFlagState ? `Flagged Roadblock: ${reason}` : 'Resolved / Unflagged Roadblock'
            }
          ]
        };
        syncTaskApi(updated);
        return updated;
      }
      return t;
    }));
  };

  const handleAddComment = (taskId: number, content: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newComment = {
          id: Date.now(),
          user: currentUser,
          content,
          createdAt: new Date().toISOString()
        };
        const updated = {
          ...t,
          comments: [...t.comments, newComment],
          updatedAt: new Date().toISOString()
        };
        syncTaskApi(updated);
        return updated;
      }
      return t;
    }));
  };

  const handleToggleReaction = (taskId: number, reactionType: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const currentList = t.reactions?.[reactionType] || [];
        const exists = currentList.includes(currentUser.name);
        const updatedList = exists
          ? currentList.filter(name => name !== currentUser.name)
          : [...currentList, currentUser.name];

        const updated = {
          ...t,
          reactions: {
            ...t.reactions,
            [reactionType]: updatedList
          }
        };
        syncTaskApi(updated);
        return updated;
      }
      return t;
    }));
  };

  const handleAddClient = (newClientData: Omit<Client, 'id'>) => {
    const newClient: Client = {
      ...newClientData,
      id: Date.now()
    };
    setClients([...clients, newClient]);
    apiFetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient)
    }).catch(() => {});
  };

  const handleUpdateClientNotes = (clientId: number, newNotes: string, newHealth?: Client['healthStatus'], fullClientData?: Partial<Client>) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          notes: newNotes,
          healthStatus: newHealth || c.healthStatus,
          ...(fullClientData || {})
        };
      }
      return c;
    }));
    apiFetch(`/api/clients/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes, healthStatus: newHealth, ...(fullClientData || {}) })
    }).catch(() => {});
  };

  const handleDeleteClient = (clientId: number) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    apiFetch(`/api/clients/${clientId}`, { method: 'DELETE' }).catch(() => {});
  };


  const handleResetDataToDefault = () => {
    if (!confirm('Clear all tasks, clients, and tax deadlines and reset the firm workspace? This cannot be undone.')) return;
    apiFetch('/api/reset', { method: 'POST' })
      .then(res => res.json().catch(() => ({})).then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.success) {
          setToasts(prev => [{ id: 'err-reset-' + Date.now(), title: '🚫 Reset Failed', message: data.error || 'Only System Administrators can reset firm data.', type: 'overdue' }, ...prev]);
          return;
        }
        localStorage.removeItem('bk_tasks');
        localStorage.removeItem('bk_clients');
        setTasks([]);
        setClients([]);
        setDeadlines([]);
      })
      .catch(() => {
        setToasts(prev => [{ id: 'err-reset-' + Date.now(), title: '🚫 Reset Failed', message: 'Network error while resetting data.', type: 'overdue' }, ...prev]);
      });
  };


  // Filter Tasks
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = tasks.filter(t => t.status !== 'DONE' && t.dueDate && t.dueDate < todayStr).length;

  const filteredTasks = tasks.filter(t => {
    // Status tab filter
    if (statusFilter === 'FLAGGED' && !t.flagged) return false;
    if (statusFilter === 'OVERDUE' && (t.status === 'DONE' || !t.dueDate || t.dueDate >= todayStr)) return false;
    if (statusFilter === 'OPEN' && t.status !== 'OPEN') return false;
    if (statusFilter === 'IN_PROGRESS' && t.status !== 'IN_PROGRESS') return false;
    if (statusFilter === 'PENDING_REVIEW' && t.status !== 'PENDING_REVIEW') return false;
    if (statusFilter === 'DONE' && t.status !== 'DONE') return false;

    // Client Filter
    if (selectedClientFilter !== 'ALL' && t.clientName !== selectedClientFilter) return false;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchClient = t.clientName.toLowerCase().includes(q);
      const matchCategory = t.category.toLowerCase().includes(q);
      const matchDescription = t.description.toLowerCase().includes(q);
      const matchCreator = t.creator.name.toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchCategory && !matchDescription && !matchCreator) {
        return false;
      }
    }

    return true;
  });

  const flaggedCount = tasks.filter(t => t.flagged).length;
  const openTasksCount = tasks.filter(t => t.status !== 'DONE').length;

  const approachingCount = tasks.filter(t => {
    if (t.status === 'DONE' || !t.dueDate) return false;
    const dueDateObj = new Date(t.dueDate);
    const todayObj = new Date(todayStr);
    const diffDays = Math.ceil((dueDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= 14;
  }).length;

  const handleTriggerAlerts = () => {
    const newToasts: ToastAlert[] = [];
    tasks.forEach((t) => {
      if (t.status === 'DONE' || !t.dueDate) return;
      if (t.dueDate < todayStr) {
        newToasts.push({
          id: 'overdue-' + t.id + '-' + Date.now(),
          title: '🚨 Overdue Tax Filing',
          message: `Task "${t.title}" for ${t.clientName} was due on ${t.dueDate}.`,
          type: 'overdue',
          taskId: t.id,
          dateStr: t.dueDate
        });
      } else {
        const dueDateObj = new Date(t.dueDate);
        const todayObj = new Date(todayStr);
        const diffDays = Math.ceil((dueDateObj.getTime() - todayObj.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 14 && diffDays >= 0) {
          newToasts.push({
            id: 'approaching-' + t.id + '-' + Date.now(),
            title: '⏰ Approaching Due Date',
            message: `Task "${t.title}" for ${t.clientName} is due in ${diffDays === 0 ? 'today' : diffDays + ' days'}.`,
            type: 'approaching',
            taskId: t.id,
            dateStr: t.dueDate
          });
        }
      }
    });

    if (newToasts.length === 0) {
      newToasts.push({
        id: 'info-' + Date.now(),
        title: '✅ All Filings On Track',
        message: 'No overdue or approaching tax deadlines at this moment.',
        type: 'info'
      });
    }

    setToasts(newToasts.slice(0, 4));
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm font-semibold">
        Checking session…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LandingPage
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Top Tax Calendar Countdown Ticker */}
      <TaxDeadlineTicker deadlines={deadlines} />

      {/* Main App Header */}
      <Header
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenAiAssistant={() => {
          if (aiEnabled) setIsAiModalOpen(true);
        }}
        flaggedCount={flaggedCount}
        openTasksCount={openTasksCount}
        overdueCount={overdueCount}
        approachingCount={approachingCount}
        onTriggerAlerts={handleTriggerAlerts}
        allUsers={allUsers}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        dbConnected={dbConnected}
        aiEnabled={aiEnabled}
      />

      {/* Pending Account Banner */}
      {currentUser?.status === 'PENDING' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-900 bg-amber-50/90 backdrop-blur-xs flex items-center justify-between gap-3">
          <div className="max-w-7xl mx-auto flex items-center gap-2.5 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Account Pending Administrator Approval:</strong> Your account is registered as <em>{currentUser.role}</em> and is awaiting verification by a System Administrator. An admin can approve your access in the Admin Hub.
            </span>
          </div>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        {/* VIEW 1: TEAM FEED VIEW */}
        {activeTab === 'FEED' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Broadcast Form */}
            <div className="lg:col-span-5">
              <BroadcastForm
                currentUser={currentUser}
                allUsers={allUsers}
                onAddTask={handleAddTask}
                aiEnabled={aiEnabled}
              />
            </div>

            {/* Right Column: Feed & Filter Toolbar */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Filter & Search Bar */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 overflow-x-auto">
                
                {/* Status Pills */}
                <div className="flex items-center gap-1.5 min-w-max w-full sm:w-auto">
                  {[
                    { id: 'ALL', label: 'All Updates' },
                    { id: 'OPEN', label: 'Open' },
                    { id: 'IN_PROGRESS', label: 'In Progress' },
                    { id: 'PENDING_REVIEW', label: 'Review' },
                    { id: 'DONE', label: 'Done' },
                    { id: 'OVERDUE', label: `⏰ Overdue (${overdueCount})` },
                    { id: 'FLAGGED', label: `🚨 Roadblocks (${flaggedCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 ${
                        statusFilter === tab.id
                          ? tab.id === 'FLAGGED'
                            ? 'bg-red-600 text-white shadow-xs'
                            : tab.id === 'OVERDUE'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Client Dropdown Filter */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                  <select
                    value={selectedClientFilter}
                    onChange={(e) => setSelectedClientFilter(e.target.value)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">All Clients</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  {currentUser?.role === 'System Administrator' && currentUser?.status === 'APPROVED' && (
                    <button
                      onClick={handleResetDataToDefault}
                      title="Reset firm data (System Administrator only)"
                      className="p-1.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>

              {/* Feed Items List */}
              <div className="space-y-4">
                {filteredTasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">No matching updates found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing filters or broadcast a new update for your accounting team.
                    </p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <FeedCard
                      key={task.id}
                      task={task}
                      currentUser={currentUser}
                      onUpdateStatus={handleUpdateStatus}
                      onToggleFlag={handleToggleFlag}
                      onAddComment={handleAddComment}
                      onToggleReaction={handleToggleReaction}
                    />
                  ))
                )}
              </div>

            </div>

          </div>
        )}

        {/* VIEW 2: CLIENT DIRECTORY VIEW */}
        {activeTab === 'CLIENTS' && (
          <ClientDirectory
            clients={clients}
            tasks={tasks}
            onSelectClientForBroadcast={(clientName) => {
              setSelectedClientFilter(clientName);
              setActiveTab('FEED');
            }}
            onAddClient={handleAddClient}
            onUpdateClientNotes={handleUpdateClientNotes}
            onDeleteClient={handleDeleteClient}
          />
        )}

        {/* VIEW 3: COMPLIANCE ANALYTICS DASHBOARD */}
        {activeTab === 'ANALYTICS' && (
          <ComplianceAnalytics
            tasks={tasks}
            clients={clients}
          />
        )}

        {/* VIEW 4: TEAM DIRECTORY & WORKLOAD TRACKER */}
        {activeTab === 'TEAM' && (
          <TeamDirectory
            tasks={tasks}
            users={allUsers}
            currentUser={currentUser}
            onDeleteUser={handleDeleteUser}
            onSelectUserForBroadcast={(userName) => {
              setActiveTab('FEED');
            }}
            onFilterByAssignee={(userName) => {
              setSearchQuery(userName);
              setActiveTab('FEED');
            }}
          />
        )}

        {/* VIEW 5: SYSTEM ADMIN CONTROL HUB */}
        {activeTab === 'ADMIN' && currentUser?.role === 'System Administrator' && currentUser?.status === 'APPROVED' && (
          <AdminPanel
            currentUser={currentUser}
            allUsers={allUsers}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateUserStatus={handleUpdateUserStatus}
            onDeleteUser={handleDeleteUser}
            onAddUser={handleAdminCreateUser}
            tasks={tasks}
            clients={clients}
            onDeleteTask={handleDeleteTask}
            onForceUpdateTaskStatus={handleUpdateStatus}
            onResetData={handleResetDataToDefault}
            onRestoreData={handleRestoreData}
            aiEnabled={aiEnabled}
            onToggleAiEnabled={handleToggleAiEnabled}
            deadlines={deadlines}
            onAddDeadline={handleAddDeadline}
            onUpdateDeadline={handleUpdateDeadline}
            onDeleteDeadline={handleDeleteDeadline}
          />
        )}

      </main>

      {/* Sign In & Sign Up Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* AI CPA Assistant Modal (conditionally rendered when AI features are enabled) */}
      {aiEnabled && (
        <AICpaAssistantModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          tasks={tasks}
        />
      )}

      {/* Floating Due Date Toast Alerts */}
      <ToastNotificationContainer
        toasts={toasts}
        onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
        onSelectTask={(taskId) => {
          setActiveTab('FEED');
          const targetTask = tasks.find(t => t.id === taskId);
          if (targetTask) {
            setSearchQuery(targetTask.title);
          }
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Accounting Portal</span>
            <span>— Internal Team Accounting Feed</span>
          </div>
          <div>
            <span>Connected as <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role})</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
