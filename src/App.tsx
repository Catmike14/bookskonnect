import React, { useState, useEffect } from 'react';
import { User, Task, TaskStatus, Client, TaxDeadline } from './types';
import { TEAM_USERS, INITIAL_CLIENTS, INITIAL_DEADLINES, INITIAL_TASKS } from './data/initialData';
import { Header } from './components/Header';
import { TaxDeadlineTicker } from './components/TaxDeadlineTicker';
import { BroadcastForm } from './components/BroadcastForm';
import { FeedCard } from './components/FeedCard';
import { ClientDirectory } from './components/ClientDirectory';
import { ComplianceAnalytics } from './components/ComplianceAnalytics';
import { TeamDirectory } from './components/TeamDirectory';
import { AICpaAssistantModal } from './components/AICpaAssistantModal';
import { ToastNotificationContainer, ToastAlert } from './components/ToastNotification';
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
  // LocalStorage persistence state initialization
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('bk_user');
    return saved ? JSON.parse(saved) : TEAM_USERS[0];
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('bk_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('bk_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [deadlines] = useState<TaxDeadline[]>(INITIAL_DEADLINES);

  const [activeTab, setActiveTab] = useState<'FEED' | 'CLIENTS' | 'ANALYTICS' | 'TEAM'>('FEED');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('ALL');

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

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
    localStorage.setItem('bk_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Handlers
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
  };

  const handleUpdateStatus = (taskId: number, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
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
      }
      return t;
    }));
  };

  const handleToggleFlag = (taskId: number, currentFlagged: boolean, reason?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextFlagState = !currentFlagged;
        return {
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
        return {
          ...t,
          comments: [...t.comments, newComment],
          updatedAt: new Date().toISOString()
        };
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

        return {
          ...t,
          reactions: {
            ...t.reactions,
            [reactionType]: updatedList
          }
        };
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
  };

  const handleUpdateClientNotes = (clientId: number, newNotes: string, newHealth?: Client['healthStatus']) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          notes: newNotes,
          healthStatus: newHealth || c.healthStatus
        };
      }
      return c;
    }));
  };

  const handleResetDataToDefault = () => {
    if (confirm('Reset demo data to initial firm state?')) {
      localStorage.removeItem('bk_tasks');
      localStorage.removeItem('bk_clients');
      setTasks(INITIAL_TASKS);
      setClients(INITIAL_CLIENTS);
    }
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
        onOpenAiAssistant={() => setIsAiModalOpen(true)}
        flaggedCount={flaggedCount}
        openTasksCount={openTasksCount}
        overdueCount={overdueCount}
        approachingCount={approachingCount}
        onTriggerAlerts={handleTriggerAlerts}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8">
        
        {/* VIEW 1: TEAM FEED VIEW */}
        {activeTab === 'FEED' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Broadcast Form */}
            <div className="lg:col-span-5">
              <BroadcastForm
                currentUser={currentUser}
                onAddTask={handleAddTask}
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

                  <button
                    onClick={handleResetDataToDefault}
                    title="Reset to default demo data"
                    className="p-1.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
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
            onSelectUserForBroadcast={(userName) => {
              setActiveTab('FEED');
            }}
            onFilterByAssignee={(userName) => {
              setSearchQuery(userName);
              setActiveTab('FEED');
            }}
          />
        )}

      </main>

      {/* AI CPA Assistant Modal */}
      <AICpaAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        tasks={tasks}
      />

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
            <span className="font-bold text-slate-800">Bookskonnect</span>
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
