import React, { useState } from 'react';
import { User, Role } from '../types';
import { TEAM_USERS } from '../data/initialData';
import { 
  X, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Briefcase, 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  Sparkles,
  KeyRound,
  UserPlus,
  LogIn,
  AlertCircle,
  Smartphone,
  Shield,
  Key,
  Check
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  allUsers: User[];
  onRegisterUser: (newUser: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  allUsers,
  onRegisterUser,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP' | '2FA'>('LOGIN');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [pending2FAUser, setPending2FAUser] = useState<User | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [enable2FA, setEnable2FA] = useState(true);
  const [showDemoShortcuts, setShowDemoShortcuts] = useState(false);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRole, setSignupRole] = useState<Role>('Senior CPA');
  const [signupFirm, setSignupFirm] = useState('Bookskonnect Advisory');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupError, setSignupError] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please enter both your email address and password.');
      return;
    }

    const normalizedEmail = loginEmail.trim().toLowerCase();
    const matchedUser = allUsers.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    ) || TEAM_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    const userToAuth = matchedUser || {
      id: Date.now(),
      name: loginEmail.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
      email: loginEmail.trim(),
      role: 'Senior CPA' as Role,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(loginEmail)}`
    };

    if (!matchedUser) {
      onRegisterUser(userToAuth);
    }

    if (enable2FA) {
      setPending2FAUser(userToAuth);
      setMode('2FA');
    } else {
      onLoginSuccess(userToAuth);
      onClose();
    }
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FAUser) return;

    if (twoFactorCode.trim().length < 4) {
      setLoginError('Please enter a valid 6-digit 2FA verification code (e.g. 123456)');
      return;
    }

    onLoginSuccess(pending2FAUser);
    onClose();
  };

  const handleQuickLogin = (user: User) => {
    if (enable2FA) {
      setPending2FAUser(user);
      setTwoFactorCode('884920'); // Autofill sample 2FA
      setMode('2FA');
    } else {
      onLoginSuccess(user);
      onClose();
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!signupName.trim()) {
      setSignupError('Please provide your full name.');
      return;
    }

    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setSignupError('Please enter a valid work email address.');
      return;
    }

    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters long.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    // Check if email already exists
    const exists = allUsers.some(
      (u) => u.email.toLowerCase() === signupEmail.trim().toLowerCase()
    );

    if (exists) {
      setSignupError('An account with this email already exists. Please log in.');
      return;
    }

    // Generate avatar using initials seed
    const avatarUrl = `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`;

    const newUser: User = {
      id: Date.now(),
      name: signupName.trim(),
      email: signupEmail.trim(),
      role: signupRole,
      avatar: avatarUrl
    };

    onRegisterUser(newUser);
    onLoginSuccess(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 px-6 py-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                Bookskonnect
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  CPA Auth
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Accounting Team Intelligence & Tax Compliance Platform
              </p>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mt-4 max-w-xs">
            <button
              onClick={() => {
                setMode('LOGIN');
                setLoginError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'LOGIN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => {
                setMode('SIGNUP');
                setSignupError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'SIGNUP'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {mode === '2FA' ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-full mx-auto flex items-center justify-center shadow-md">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">Two-Factor Authentication (2FA)</h3>
                <p className="text-xs text-slate-600">
                  A 6-digit verification code was generated for <strong className="text-emerald-800">{pending2FAUser?.email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                    Enter Security OTP Verification Code
                  </label>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="e.g. 884920"
                    maxLength={6}
                    className="w-full text-center tracking-widest text-lg font-black py-3 bg-slate-50 border border-slate-300 rounded-2xl outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[10px] text-slate-400 text-center mt-1">
                    Demo Code pre-filled or enter any 6 digits to verify session token.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate & Open Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          ) : mode === 'LOGIN' ? (
            <div className="space-y-6">
              {/* Credentials Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>Log in with Account Credentials</span>
                </div>

                {loginError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. cpa@bookskonnect.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Switch Demo Accounts Option */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Demo Account Shortcuts
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDemoShortcuts(!showDemoShortcuts)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition cursor-pointer"
                  >
                    {showDemoShortcuts ? 'Hide Demo Shortcuts' : 'Show Demo Quick-Login Shortcuts'}
                  </button>
                </div>

                {showDemoShortcuts && (
                  <div className="space-y-3 pt-2">
                    {/* Admin Master Highlight Card */}
                    {allUsers.find(u => u.role === 'System Administrator') && (
                      <button
                        type="button"
                        onClick={() => {
                          const adminUser = allUsers.find(u => u.role === 'System Administrator');
                          if (adminUser) {
                            setLoginEmail(adminUser.email);
                            setLoginPassword('admin123');
                          }
                        }}
                        className="w-full p-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-500/40 hover:border-indigo-400 flex items-center justify-between shadow-lg transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center text-indigo-300 font-bold">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-black text-white flex items-center gap-2">
                              Admin Master Account
                              <span className="bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase">
                                Pre-fill Admin Credentials
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300">admin@bookskonnect.com (Password: admin123)</div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {allUsers.filter(u => u.role !== 'System Administrator').slice(0, 6).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleQuickLogin(u)}
                          className="flex items-center gap-3 p-2.5 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition cursor-pointer group"
                        >
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 group-hover:ring-emerald-400"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 truncate">
                              {u.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">
                              {u.role}
                            </div>
                          </div>
                          <ShieldCheck className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Sign Up Form */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Register New CPA or Accountant Account</span>
              </div>

              {signupError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{signupError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name & Title
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="e.g. Maria Santos, CPA"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Work Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="m.santos@firm.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Team Role / Designation
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                    <select
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value as Role)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none cursor-pointer"
                    >
                      <option value="System Administrator">System Administrator (Full Control)</option>
                      <option value="Manager">Manager / Partner</option>
                      <option value="Senior CPA">Senior CPA</option>
                      <option value="Staff Auditor">Staff Auditor</option>
                      <option value="Tax Specialist">Tax Specialist</option>
                      <option value="Bookkeeper">Bookkeeper</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Accounting Firm / Office
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={signupFirm}
                      onChange={(e) => setSignupFirm(e.target.value)}
                      placeholder="e.g. Catorce & Partners"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Create Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 6 chars"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Account & Join Team</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
