import React from 'react';
import { User } from '../types';
import { 
  Layers, 
  Search, 
  Sparkles, 
  Users, 
  BarChart3, 
  MessageSquareText, 
  ShieldAlert, 
  ChevronDown,
  Building2,
  CheckCircle2,
  Bell,
  Clock,
  LogIn,
  UserPlus,
  LogOut,
  UserCheck,
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  activeTab: 'FEED' | 'CLIENTS' | 'ANALYTICS' | 'TEAM' | 'ADMIN';
  setActiveTab: (tab: 'FEED' | 'CLIENTS' | 'ANALYTICS' | 'TEAM' | 'ADMIN') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenAiAssistant: () => void;
  flaggedCount: number;
  openTasksCount: number;
  overdueCount?: number;
  approachingCount?: number;
  onTriggerAlerts?: () => void;
  allUsers?: User[];
  onOpenAuthModal?: (mode?: 'LOGIN' | 'SIGNUP') => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSelectUser,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenAiAssistant,
  flaggedCount,
  openTasksCount,
  overdueCount = 0,
  approachingCount = 0,
  onTriggerAlerts,
  allUsers = [],
  onOpenAuthModal,
  onLogout,
}) => {
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const totalDueAlerts = overdueCount + approachingCount;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & Navigation */}
        <div className="flex items-center justify-between w-full md:w-auto gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('FEED')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">Bookskonnect</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  CPAs & Tax Feed
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                Accounting Team Intelligence & Compliance
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('FEED')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'FEED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Team Feed</span>
              {openTasksCount > 0 && (
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
                  {openTasksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('CLIENTS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'CLIENTS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Client Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'ANALYTICS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Compliance Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('TEAM')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'TEAM'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team Directory</span>
            </button>

            <button
              onClick={() => setActiveTab('ADMIN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'ADMIN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : currentUser.role === 'System Administrator'
                  ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Control</span>
              {currentUser.role === 'System Administrator' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>
          </nav>
        </div>

        {/* Center: Search & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Mobile Tab Switcher */}
          <div className="flex sm:hidden w-full bg-slate-100 p-1 rounded-xl border border-slate-200/60 mb-2 md:mb-0 justify-around text-xs font-semibold">
            <button
              onClick={() => setActiveTab('FEED')}
              className={`px-3 py-1.5 rounded-lg ${activeTab === 'FEED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Feed
            </button>
            <button
              onClick={() => setActiveTab('CLIENTS')}
              className={`px-3 py-1.5 rounded-lg ${activeTab === 'CLIENTS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Clients
            </button>
            <button
              onClick={() => setActiveTab('ANALYTICS')}
              className={`px-3 py-1.5 rounded-lg ${activeTab === 'ANALYTICS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('TEAM')}
              className={`px-3 py-1.5 rounded-lg ${activeTab === 'TEAM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Team
            </button>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients, BIR forms, tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
            />
          </div>

          {/* Due Date Bell Alert Button */}
          {onTriggerAlerts && (
            <button
              onClick={onTriggerAlerts}
              title={`${totalDueAlerts} due date alerts (overdue or approaching)`}
              className={`relative p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                totalDueAlerts > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <Bell className="w-4 h-4" />
              {totalDueAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {totalDueAlerts}
                </span>
              )}
            </button>
          )}

          {/* AI CPA Assistant Trigger Button */}
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4 text-emerald-200 animate-pulse" />
            <span className="hidden lg:inline">AI CPA Assistant</span>
          </button>

          {/* Flagged Roadblock Counter Warning if any */}
          {flaggedCount > 0 && (
            <div 
              onClick={() => setActiveTab('FEED')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-red-100 transition shrink-0"
              title={`${flaggedCount} Roadblocks require team attention`}
            >
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>{flaggedCount}</span>
            </div>
          )}

          {/* User Profile / Role Switcher Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/70 p-1.5 pl-3 rounded-xl border border-slate-200 transition cursor-pointer"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-xs"
              />
              <div className="text-left hidden lg:block pr-1">
                <div className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</div>
                <div className="text-[10px] text-slate-500 font-semibold">{currentUser.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Dropdown Menu to switch user perspective or auth */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                
                {/* Auth Actions Header */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Active Session</div>
                  <div className="flex items-center gap-2">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</div>
                      <div className="text-[10px] text-slate-500 font-semibold">{currentUser.role}</div>
                    </div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                </div>

                {/* Quick Auth Buttons */}
                <div className="space-y-1 mb-2 pb-2 border-b border-slate-100">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      if (onOpenAuthModal) onOpenAuthModal('LOGIN');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Sign In to Account</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      if (onOpenAuthModal) onOpenAuthModal('SIGNUP');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Register New CPA Profile</span>
                  </button>
                </div>

                {/* Switch User List */}
                <div className="px-3 py-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Switch Team Profile</span>
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSelectUser(user);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
                        currentUser.id === user.id ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{user.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user.role}</div>
                      </div>
                      {currentUser.id === user.id && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Logout Button */}
                {onLogout && (
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
