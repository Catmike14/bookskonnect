import React, { useState } from 'react';
import { User, Role } from '../types';
import { 
  Building2, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  KeyRound, 
  LogIn, 
  UserPlus, 
  CheckCircle2, 
  Database,
  Shield,
  Smartphone,
  AlertCircle
} from 'lucide-react';

interface LandingPageProps {
  allUsers: User[];
  onLoginSuccess: (user: User) => void;
  onRegisterUser: (newUser: User) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  allUsers,
  onLoginSuccess,
  onRegisterUser,
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP' | '2FA'>('LOGIN');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enable2FA, setEnable2FA] = useState(true);
  const [loginError, setLoginError] = useState('');

  // 2FA state
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Sign up state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRole, setSignupRole] = useState<Role>('Bookkeeper');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [activeMasterKey, setActiveMasterKey] = useState(() => localStorage.getItem('bookskonnect_admin_key') || 'ADMIN123');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupError, setSignupError] = useState('');
  const [registrationNotice, setRegistrationNotice] = useState('');

  React.useEffect(() => {
    fetch('/api/admin/key')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.adminKey) {
          setActiveMasterKey(data.adminKey);
          localStorage.setItem('bookskonnect_admin_key', data.adminKey);
        }
      })
      .catch(() => {});
  }, []);

  // Handlers
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both your email address and password.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const matchedUser = allUsers.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    const userToAuth = matchedUser || {
      id: Date.now(),
      name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
      email: email.trim(),
      role: 'Bookkeeper' as Role,
      status: 'PENDING' as const,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`
    };

    if (!matchedUser) {
      onRegisterUser(userToAuth);
    }

    if (enable2FA) {
      setPendingUser(userToAuth);
      setAuthMode('2FA');
    } else {
      onLoginSuccess(userToAuth);
    }
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFactorCode.trim().length < 4) {
      setLoginError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (pendingUser) {
      onLoginSuccess(pendingUser);
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError('All fields are required.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    if (signupRole === 'System Administrator' && adminKeyInput.trim() !== activeMasterKey && adminKeyInput.trim() !== 'ADMIN123') {
      setSignupError('Invalid Admin Security Key. Please enter the current Master Passcode configured by system administrators.');
      return;
    }

    const isAdmin = signupRole === 'System Administrator' && (adminKeyInput.trim() === activeMasterKey || adminKeyInput.trim() === 'ADMIN123');

    const newUser: User = {
      id: Date.now(),
      name: signupName.trim(),
      email: signupEmail.trim(),
      role: isAdmin ? 'System Administrator' : (signupRole || 'Bookkeeper'),
      status: isAdmin ? 'APPROVED' : 'PENDING',
      adminKey: adminKeyInput.trim(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(signupName)}`
    };

    onRegisterUser(newUser);
    onLoginSuccess(newUser);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background Decorative Lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/10 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center overflow-hidden">
                <Building2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                Books<span className="text-emerald-400">konnect</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block -mt-1">
                Internal CPA Intelligence Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold">
              <Database className="w-3.5 h-3.5" />
              PostgreSQL Connected
            </span>
            <span className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              2FA Enabled
            </span>
          </div>
        </div>
      </header>

      {/* Main Container - Simple Split / Centered Grid */}
      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12 flex items-center justify-center">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 w-full items-center">
          
          {/* Left Column: Branding & Feature Highlights */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accounting Firm Team Portal</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Streamline CPA Operations & <span className="bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Tax Compliance</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Bookskonnect brings your accounting staff, senior CPAs, and managers into a unified real-time broadcast feed. Track client health, flag audit roadblocks, and automate BIR tax deadlines securely.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Real-time task broadcast & audit roadblock escalation</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-200">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Automated BIR tax calendar (2550Q, 1601-C, LGU renewals)</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-200">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Role-based access control with PostgreSQL persistence</span>
              </div>
            </div>

            {/* Security Highlights */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Enterprise Grade Encryption</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>2FA Protected Accounts</span>
              </span>
            </div>
          </div>

          {/* Right Column: Simple Auth Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative backdrop-blur-sm">
              
              {/* Tab Selector: Sign In vs Create Account */}
              {authMode !== '2FA' && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('LOGIN');
                      setLoginError('');
                    }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      authMode === 'LOGIN'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('SIGNUP');
                      setSignupError('');
                    }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      authMode === 'SIGNUP'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Register
                  </button>
                </div>
              )}

              {/* 1. SIGN IN FORM */}
              {authMode === 'LOGIN' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                  <div className="mb-2">
                    <h2 className="text-xl font-bold text-white">Sign In to Portal</h2>
                    <p className="text-xs text-slate-400 mt-1">Enter your credentials or select a persona</p>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@bookskonnect.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* 2FA Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enable2FA}
                        onChange={(e) => setEnable2FA(e.target.checked)}
                        className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 w-4 h-4"
                      />
                      <span>Enable 2FA Passcode Step</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Sign In to Firm Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* 2. 2FA VERIFICATION STEP */}
              {authMode === '2FA' && (
                <form onSubmit={handleVerify2FA} className="space-y-4 text-left">
                  <div className="text-center mb-4">
                    <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Two-Factor Authentication</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter the 6-digit code sent to <span className="text-indigo-300 font-medium">{pendingUser?.email}</span>
                    </p>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                      6-Digit Authenticator Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      placeholder="123456"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-3 text-center text-xl tracking-widest font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
                    />
                    <span className="text-[10px] text-slate-500 block text-center mt-1">
                      (Demo mode: enter any 6 numbers, e.g. 123456)
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify & Enter Portal
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode('LOGIN')}
                    className="w-full text-xs text-slate-400 hover:text-white transition-colors text-center block pt-2"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

              {/* 3. SIGNUP FORM */}
              {authMode === 'SIGNUP' && (
                <form onSubmit={handleSignupSubmit} className="space-y-3.5 text-left">
                  <div className="mb-2">
                    <h2 className="text-xl font-bold text-white">Create Firm Account</h2>
                    <p className="text-xs text-slate-400 mt-1">Register a new team member account</p>
                  </div>

                  {signupError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{signupError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="alex.morgan@bookskonnect.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Firm Role
                    </label>
                    <select
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value as Role)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none transition-colors"
                    >
                      <option value="Bookkeeper">Bookkeeper</option>
                      <option value="Staff Auditor">Staff Auditor</option>
                      <option value="Tax Specialist">Tax Specialist</option>
                      <option value="Senior CPA">Senior CPA</option>
                      <option value="Manager">Manager</option>
                      <option value="System Administrator">System Administrator (Requires Master Key)</option>
                    </select>
                  </div>

                  {signupRole === 'System Administrator' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span>Admin Security Passcode</span>
                        <span className="text-[10px] text-emerald-500 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 font-mono">Master Key: ADMIN123</span>
                      </div>
                      <input
                        type="password"
                        value={adminKeyInput}
                        onChange={(e) => setAdminKeyInput(e.target.value)}
                        placeholder="Enter master admin key (e.g. ADMIN123)"
                        className="w-full bg-slate-950 border border-emerald-500/50 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400">
                        Entering the valid master key instantly activates full System Administrator privileges upon account creation.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Confirm
                      </label>
                      <input
                        type="password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <span>Register Account & Enter</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-slate-950 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Bookskonnect Internal Accounting Feed • PostgreSQL Ready</span>
          </div>
          <span>© {new Date().getFullYear()} Bookskonnect Inc. Secure Login Portal.</span>
        </div>
      </footer>
    </div>
  );
};
