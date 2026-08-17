import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, Task, TaskStatus, Client, TaxDeadline, Role, Priority } from './types';
import { INITIAL_CLIENTS, INITIAL_DEADLINES, INITIAL_TASKS } from './data/initialData';
import { planDeadlineGeneration } from './utils/birCalendar';
import { Header } from './components/Header';
import { TaxDeadlineTicker } from './components/TaxDeadlineTicker';
import { BroadcastForm } from './components/BroadcastForm';
import { FeedCard } from './components/FeedCard';
import { LandingPage } from './components/LandingPage';
import { ToastNotificationContainer, ToastAlert } from './components/ToastNotification';
import { fetchCurrentUser, logout as authLogout } from './utils/authClient';
import { apiFetch } from './utils/apiFetch';

// Code-split the heavier tab views and admin/AI panels -- they're each only
// needed once the person actually navigates to that tab (or, for
// AdminPanel, only for the small subset of users who are admins at all), so
// there's no reason to make everyone pay their parse/execute cost on first
// load of the default Feed tab.
const ClientDirectory = lazy(() => import('./components/ClientDirectory').then(m => ({ default: m.ClientDirectory })));
const ComplianceAnalytics = lazy(() => import('./components/ComplianceAnalytics').then(m => ({ default: m.ComplianceAnalytics })));
const TeamDirectory = lazy(() => import('./components/TeamDirectory').then(m => ({ default: m.TeamDirectory })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const AICpaAssistantModal = lazy(() => import('./components/AICpaAssistantModal').then(m => ({ default: m.AICpaAssistantModal })));

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400 text-sm font-semibold">
      Loading…
    </div>
  );
}

import { 
  Inbox, 
  RefreshCw, 
  ShieldAlert,
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
  const [pendingAssigneeId, setPendingAssigneeId] = useState<number | null>(null);

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  // AI Staff Assistant & Gemini Features Enable/Disable State
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

  // Admin Hub: reset a team member's password without needing email
  // infrastructure. Returns the one-time temp password for the admin to
  // relay out-of-band -- same pattern as provisioning a brand new account.
  const handleAdminResetPassword = async (userId: number): Promise<{ success: boolean; error?: string; tempPassword?: string }> => {
    try {
      const res = await apiFetch(`/api/users/${userId}/reset-password`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to reset password.' };
      }
      return { success: true, tempPassword: data.tempPassword };
    } catch (e) {
      return { success: false, error: 'Network error resetting password.' };
    }
  };

  const handleDeleteTask = (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    syncMutation(
      `/api/tasks/${taskId}`,
      { method: 'DELETE' },
      'This task could not be deleted on the server. It may reappear after a refresh.'
    );
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
      if (res.ok && data.success && data.deadline) {
        setDeadlines(prev => [...prev, data.deadline]);
      } else {
        notifySyncFailure(data.error || 'This deadline could not be saved to the server. Please refresh and try again.');
      }
    } catch (e) {
      notifySyncFailure('Network error -- this deadline could not be saved. Please check your connection and try again.');
    }
  };

  const handleUpdateDeadline = async (id: number, fields: Partial<TaxDeadline>) => {
    setDeadlines(prev => prev.map(d => (d.id === id ? { ...d, ...fields } : d)));
    syncMutation(
      `/api/deadlines/${id}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) },
      'This deadline update could not be saved to the server. Please refresh and try again.'
    );
  };

  const handleDeleteDeadline = async (id: number) => {
    setDeadlines(prev => prev.filter(d => d.id !== id));
    syncMutation(
      `/api/deadlines/${id}`,
      { method: 'DELETE' },
      'This deadline could not be deleted on the server. It may reappear after a refresh.'
    );
  };

  // Auto-generates upcoming compliance deadlines (and the matching actionable
  // task for each) from a client's registered tax types, using the BIR
  // filing calendar. This is the actual "automate BIR tax deadlines"
  // feature -- everything else in the app was either firm-wide-only or a
  // one-off text template. The planning (what's missing, what dates apply)
  // is a pure function in utils/birCalendar.ts so it's unit-testable on its
  // own; this handler just executes the plan through the normal
  // create-deadline/create-task paths, so it works the same whether or not
  // a database is connected.
  const GENERATION_WINDOW_MONTHS = 3;

  const handleGenerateDeadlines = (scopeClientId?: number): { deadlinesCreated: number; tasksCreated: number; clientsCovered: number } => {
    const targetClients = scopeClientId != null ? clients.filter(c => c.id === scopeClientId) : clients;
    const plan = planDeadlineGeneration(targetClients, deadlines, tasks, GENERATION_WINDOW_MONTHS);

    let deadlinesCreated = 0;
    let tasksCreated = 0;

    for (const item of plan) {
      if (item.needsDeadline) {
        handleAddDeadline({
          formCode: item.formCode,
          name: item.name,
          deadlineDate: item.deadlineDate,
          description: item.description,
          status: 'Upcoming',
          clientId: item.clientId,
        });
        deadlinesCreated++;
      }

      if (item.needsTask) {
        const client = targetClients.find(c => c.id === item.clientId);
        const daysUntilDue = Math.ceil((new Date(item.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const priority: Priority = daysUntilDue <= 7 ? 'URGENT' : daysUntilDue <= 21 ? 'HIGH' : 'NORMAL';
        const assignee = allUsers.find(u => u.name === client?.managerInCharge);

        handleAddTask({
          title: `File ${item.formCode} — ${item.name.split(' — ')[0]} (${item.periodLabel})`,
          clientName: item.clientName,
          description: `Auto-generated from the BIR filing calendar. ${item.clientName} is registered for "${item.taxType}", due ${item.deadlineDate} covering ${item.periodLabel}. Verify against current BIR/RMC guidance before filing.`,
          status: 'OPEN',
          category: item.category,
          priority,
          dueDate: item.deadlineDate,
          flagged: false,
          flagReason: null,
          flagDate: null,
          creator: currentUser,
          assignee,
        });
        tasksCreated++;
      }
    }

    return { deadlinesCreated, tasksCreated, clientsCovered: targetClients.length };
  };

  const handleRestoreData = async (importedData: { tasks?: Task[]; clients?: Client[]; users?: User[] }): Promise<{ tasksRestored: number; clientsRestored: number; usersSkipped: boolean }> => {
    let tasksRestored = 0;
    let clientsRestored = 0;

    if (importedData.tasks && importedData.tasks.length > 0) {
      setTasks(importedData.tasks);
      // Push each task up to the server too -- previously this only updated
      // local React state, so a restore looked successful but silently
      // never touched Postgres and was lost on refresh whenever a database
      // was actually connected.
      for (const t of importedData.tasks) {
        try {
          const res = await apiFetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t)
          });
          if (res.ok) tasksRestored++;
        } catch (e) { /* continue with the rest of the batch */ }
      }
    }

    if (importedData.clients && importedData.clients.length > 0) {
      setClients(importedData.clients);
      for (const c of importedData.clients) {
        try {
          const res = await apiFetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(c)
          });
          if (res.ok) clientsRestored++;
        } catch (e) { /* continue with the rest of the batch */ }
      }
    }

    // Deliberately not restoring `users` from a JSON backup: accounts are
    // now backed by real password hashes issued only through signup or
    // Admin Hub → Add User. Importing plain user objects from an old
    // backup would create entries in the UI that look like real team
    // members but have no password and can never log in.
    const usersSkipped = Boolean(importedData.users && importedData.users.length > 0);

    return { tasksRestored, clientsRestored, usersSkipped };
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
    setToasts(prev => [
      {
        id: 'auth-' + Date.now(),
        title: '✅ Authenticated',
        message: `Welcome back, ${user.name}! Active role set to ${user.role}.`,
        type: 'approaching',
        dateStr: new Date().toLocaleDateString(),
        autoDismissMs: 5000
      },
      ...prev
    ]);
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    // Reset away from any admin-only (or otherwise gated) tab so it can't
    // linger as stale state and cause a misleading "Access Restricted"
    // toast to fire the moment currentUser flips to null (see the
    // ADMIN-tab-guard effect below -- it reacts to currentUser changing,
    // and a stale activeTab='ADMIN' would make it fire for the wrong
    // reason: "you're signed out", not "you lack permission").
    setActiveTab('FEED');
    // Toasts from the session that just ended aren't useful context for
    // whatever comes next (a fresh login, or someone else's session on
    // this device) -- start clean rather than carrying stale notifications
    // across a sign-out.
    setToasts([
      {
        id: 'logout-' + Date.now(),
        title: '👋 Signed Out',
        message: 'You have been signed out. Please sign in or register to continue.',
        type: 'approaching',
        dateStr: new Date().toLocaleDateString(),
        autoDismissMs: 5000
      }
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
    // Don't evaluate this at all until we actually know who (if anyone) is
    // signed in -- otherwise the brief window while fetchCurrentUser() is
    // still resolving on page load looks identical to "not an admin" and
    // would fire a false-positive toast before the real answer comes back.
    if (isCheckingSession) return;
    // A signed-out user landing on this tab isn't a permissions problem --
    // it's just "you're signed out" (handleLogout already shows that
    // message and resets activeTab away from ADMIN on its own). Only warn
    // about restricted access when someone IS signed in but isn't an
    // approved admin -- that's the actual "Access Restricted" case.
    if (!currentUser) return;
    if (activeTab === 'ADMIN' && (currentUser.role !== 'System Administrator' || currentUser.status !== 'APPROVED')) {
      setActiveTab('FEED');
      setToasts(prev => [
        {
          id: 'access-denied-' + Date.now(),
          title: '🚫 Access Restricted',
          message: 'Only verified System Administrators can access the System Admin Control Hub.',
          type: 'overdue',
          autoDismissMs: 5000
        },
        ...prev
      ]);
    }
  }, [currentUser, activeTab, isCheckingSession]);

  // Handlers
  // NOTE: fetch() does not reject on HTTP error statuses (403, 500, etc.) --
  // only on genuine network failure. A bare .catch(() => {}) would silently
  // swallow those the same way it swallows network errors, so a rejected
  // update (session expired, CSRF mismatch, approval revoked mid-session)
  // would leave an optimistic UI change looking successful while nothing
  // was actually saved server-side. Every mutation below routes through
  // this helper specifically so that gap can't quietly reopen in just one
  // of them -- checks response.ok and surfaces a toast either way.
  const notifySyncFailure = (fallbackMessage: string) => {
    setToasts(prev => [{
      id: 'sync-fail-' + Date.now(),
      title: '⚠️ Change Not Saved',
      message: fallbackMessage,
      type: 'overdue',
      autoDismissMs: 7000
    }, ...prev]);
  };

  /** Fire-and-forget mutation with proper failure surfacing. Use for calls
   * where the caller has already applied an optimistic local update and
   * just needs the server write to happen in the background. */
  const syncMutation = async (url: string, options: RequestInit, fallbackMessage: string) => {
    try {
      const res = await apiFetch(url, options);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notifySyncFailure(data.error || fallbackMessage);
      }
    } catch (err) {
      notifySyncFailure(`Network error -- ${fallbackMessage.charAt(0).toLowerCase()}${fallbackMessage.slice(1)}`);
    }
  };

  const syncTaskApi = (task: Task) => {
    syncMutation(
      '/api/tasks',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) },
      'This change could not be saved to the server. Please refresh and try again.'
    );
  };

  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'auditLog' | 'reactions' | 'comments'>) => {
    // Temporary client-side id for the optimistic UI update / React key
    // only. Date.now() is milliseconds-since-epoch (~1.78 trillion in
    // 2026) -- far larger than a standard Postgres `serial`/`integer`
    // column's ~2.1 billion max, so it can NEVER be sent to the server as
    // a real id (every query filtering on it would fail with "value out
    // of range for type integer"). The small random offset just reduces
    // (doesn't need to eliminate) same-millisecond collisions when
    // several tasks are created in a tight loop, e.g. BIR calendar
    // generation.
    const tempId = Date.now() + Math.floor(Math.random() * 1000);
    const newTask: Task = {
      ...newTaskData,
      id: tempId,
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

    setTasks(prev => [newTask, ...prev]);

    // Deliberately omit `id` from the payload -- the temp id above must
    // never reach the database. Without an id, the server always treats
    // this as a fresh insert and Postgres's own auto-increment assigns a
    // real, valid id, which we then swap into local state so every later
    // update (status change, comment, flag) targets the correct row.
    const { id: _tempId, ...payloadWithoutId } = newTask;
    apiFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithoutId)
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.taskId != null && data.taskId !== tempId) {
          setTasks(prev => prev.map(t => (t.id === tempId ? { ...t, id: data.taskId } : t)));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        notifySyncFailure(data.error || 'This task could not be saved to the server. Please refresh and try again.');
      }
    }).catch(() => {
      notifySyncFailure('Network error -- this task could not be saved. Please check your connection and try again.');
    });
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
    // Same class of bug as task creation: Date.now() is way too large for
    // a standard Postgres serial/integer column, so it's a client-side-only
    // temp id for the optimistic UI update -- never sent to the server.
    const tempId = Date.now() + Math.floor(Math.random() * 1000);
    const newClient: Client = {
      ...newClientData,
      id: tempId
    };
    setClients(prev => [...prev, newClient]);

    const { id: _tempId, ...payloadWithoutId } = newClient;
    apiFetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithoutId)
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.client?.id != null && data.client.id !== tempId) {
          setClients(prev => prev.map(c => (c.id === tempId ? { ...c, id: data.client.id } : c)));
        }
      } else {
        const data = await res.json().catch(() => ({}));
        notifySyncFailure(data.error || 'This client could not be saved to the server. Please refresh and try again.');
      }
    }).catch(() => {
      notifySyncFailure('Network error -- this client could not be saved. Please check your connection and try again.');
    });
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
    syncMutation(
      `/api/clients/${clientId}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: newNotes, healthStatus: newHealth, ...(fullClientData || {}) }) },
      'This client update could not be saved to the server. Please refresh and try again.'
    );
  };

  const handleDeleteClient = (clientId: number) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    syncMutation(
      `/api/clients/${clientId}`,
      { method: 'DELETE' },
      'This client could not be deleted on the server. It may reappear after a refresh.'
    );
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
      const matchAssignee = t.assignee?.name.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchClient && !matchCategory && !matchDescription && !matchCreator && !matchAssignee) {
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
      <TaxDeadlineTicker deadlines={deadlines} clients={clients} />

      {/* Main App Header */}
      <Header
        currentUser={currentUser}
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
                clients={clients}
                onAddTask={handleAddTask}
                aiEnabled={aiEnabled}
                defaultAssigneeId={pendingAssigneeId}
                onConsumedDefaultAssignee={() => setPendingAssigneeId(null)}
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
                      onDeleteTask={handleDeleteTask}
                    />
                  ))
                )}
              </div>

            </div>

          </div>
        )}

        {/* VIEW 2: CLIENT DIRECTORY VIEW */}
        {activeTab === 'CLIENTS' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ClientDirectory
              clients={clients}
              tasks={tasks}
              deadlines={deadlines}
              onSelectClientForBroadcast={(clientName) => {
                setSelectedClientFilter(clientName);
                setActiveTab('FEED');
              }}
              onAddClient={handleAddClient}
              onUpdateClientNotes={handleUpdateClientNotes}
              onDeleteClient={handleDeleteClient}
              onGenerateDeadlines={handleGenerateDeadlines}
            />
          </Suspense>
        )}

        {/* VIEW 3: COMPLIANCE ANALYTICS DASHBOARD */}
        {activeTab === 'ANALYTICS' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <ComplianceAnalytics
              tasks={tasks}
              clients={clients}
            />
          </Suspense>
        )}

        {/* VIEW 4: TEAM DIRECTORY & WORKLOAD TRACKER */}
        {activeTab === 'TEAM' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <TeamDirectory
              tasks={tasks}
              users={allUsers}
              currentUser={currentUser}
              onDeleteUser={handleDeleteUser}
              onSelectUserForBroadcast={(userName) => {
                const targetUser = allUsers.find(u => u.name === userName);
                setPendingAssigneeId(targetUser ? targetUser.id : null);
                setActiveTab('FEED');
              }}
              onFilterByAssignee={(userName) => {
                setSearchQuery(userName);
                setActiveTab('FEED');
              }}
            />
          </Suspense>
        )}

        {/* VIEW 5: SYSTEM ADMIN CONTROL HUB */}
        {activeTab === 'ADMIN' && currentUser?.role === 'System Administrator' && currentUser?.status === 'APPROVED' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <AdminPanel
              currentUser={currentUser}
              allUsers={allUsers}
              onUpdateUserRole={handleUpdateUserRole}
              onUpdateUserStatus={handleUpdateUserStatus}
              onDeleteUser={handleDeleteUser}
              onAddUser={handleAdminCreateUser}
              onResetUserPassword={handleAdminResetPassword}
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
              onGenerateDeadlines={handleGenerateDeadlines}
            />
          </Suspense>
        )}

      </main>

      {/* AI Staff Assistant Modal (conditionally rendered when AI features are enabled) */}
      {aiEnabled && isAiModalOpen && (
        <Suspense fallback={null}>
          <AICpaAssistantModal
            isOpen={isAiModalOpen}
            onClose={() => setIsAiModalOpen(false)}
            tasks={tasks}
          />
        </Suspense>
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
