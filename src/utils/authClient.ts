import { User, Role } from '../types';
import { apiFetch } from './apiFetch';

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

async function parseJsonSafely(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Log in with email + password. The server verifies the password hash and,
 * on success, sets an httpOnly session cookie -- there is no client-side
 * notion of "authenticated" beyond what the server confirms via /me.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || 'Login failed.' };
  }
  return { success: true, user: data.user };
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  adminKeyAttempt?: string;
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || 'Failed to create account.' };
  }
  return { success: true, user: data.user };
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore -- client will still clear local state
  }
}

/** Ask the server who (if anyone) the current session cookie belongs to. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const data = await parseJsonSafely(res);
    return data.success ? (data.user as User) : null;
  } catch {
    return null;
  }
}

export async function fetchAdminRegLocked(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/admin-reg-status');
    const data = await parseJsonSafely(res);
    return Boolean(data.locked);
  } catch {
    return false;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
  const res = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await parseJsonSafely(res);
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || 'Failed to change password.' };
  }
  return { success: true };
}
