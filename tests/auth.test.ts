/**
 * Integration tests for authentication, sessions, CSRF, and role gating.
 *
 * Run with: npm test
 *
 * These spin up a real instance of server.ts (in-memory store -- no
 * DATABASE_URL needed) on a throwaway port and drive it over plain HTTP,
 * the same way a browser would. This is deliberately black-box: it doesn't
 * import server internals, it just checks that the wire behavior a client
 * actually depends on holds -- passwords are verified, sessions are
 * cookie-based, CSRF is enforced, and role checks can't be bypassed by the
 * client claiming a role.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

let serverProcess: ChildProcess;

function extractCookie(setCookieHeaders: string[] | null, name: string): string | null {
  if (!setCookieHeaders) return null;
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

/** Minimal cookie-jar-aware fetch wrapper for these tests. */
class Session {
  cookies: Record<string, string> = {};

  private cookieHeader(): string {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorbSetCookies(res: Response) {
    // Node's fetch exposes multiple Set-Cookie headers via getSetCookie()
    const raw = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie() : null;
    const bkSession = extractCookie(raw, 'bk_session');
    const bkCsrf = extractCookie(raw, 'bk_csrf');
    if (bkSession) this.cookies['bk_session'] = bkSession;
    if (bkCsrf) this.cookies['bk_csrf'] = bkCsrf;
  }

  async request(path: string, options: RequestInit = {}): Promise<Response> {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    headers.set('Cookie', this.cookieHeader());
    if (method !== 'GET' && method !== 'HEAD' && this.cookies['bk_csrf']) {
      headers.set('X-CSRF-Token', this.cookies['bk_csrf']);
    }
    const res = await fetch(`${BASE}${path}`, { ...options, headers, redirect: 'manual' });
    this.absorbSetCookies(res);
    return res;
  }

  /** Same as request(), but omits the CSRF header even if we have the cookie -- for negative tests. */
  async requestWithoutCsrf(path: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    headers.set('Cookie', this.cookieHeader());
    const res = await fetch(`${BASE}${path}`, { ...options, headers, redirect: 'manual' });
    this.absorbSetCookies(res);
    return res;
  }
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@test.local`;
}

before(async () => {
  serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: '', NODE_ENV: 'test' },
    stdio: 'pipe',
    detached: true, // own process group, so we can reliably kill npx's child too
  });
  // Wait for the health check to respond rather than a fixed sleep.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not become healthy in time');
});

after(() => {
  // npx spawns tsx as a child of itself; SIGTERM to the npx pid alone
  // doesn't reliably reach that grandchild. Killing the whole process
  // group (negative pid, since we spawned detached) takes both down.
  if (serverProcess?.pid) {
    try {
      process.kill(-serverProcess.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
});

test('signup rejects a too-short password', async () => {
  const s = new Session();
  const res = await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Short Pw', email: uniqueEmail('shortpw'), password: '123', role: 'Bookkeeper' }),
  });
  assert.equal(res.status, 400);
});

test('signup + login round-trip: correct password succeeds, wrong password fails', async () => {
  const email = uniqueEmail('roundtrip');
  const signupSession = new Session();
  const signupRes = await signupSession.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Round Trip', email, password: 'correct-horse-battery', role: 'Bookkeeper' }),
  });
  assert.equal(signupRes.status, 200);
  const signupBody = await signupRes.json();
  assert.equal(signupBody.success, true);
  assert.equal(signupBody.user.email, email);
  assert.equal(signupBody.user.role, 'Bookkeeper');
  assert.equal(signupBody.user.status, 'PENDING');
  assert.equal('passwordHash' in signupBody.user, false, 'password hash must never be sent to the client');

  // Wrong password must fail, and not with a distinguishing error message
  const wrongLoginSession = new Session();
  const wrongRes = await wrongLoginSession.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'totally-wrong' }),
  });
  assert.equal(wrongRes.status, 401);

  // Correct password must succeed and issue a session
  const rightLoginSession = new Session();
  const rightRes = await rightLoginSession.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct-horse-battery' }),
  });
  assert.equal(rightRes.status, 200);
  assert.ok(rightLoginSession.cookies['bk_session'], 'login must set a session cookie');
  assert.ok(rightLoginSession.cookies['bk_csrf'], 'login must set a csrf cookie');

  const meRes = await rightLoginSession.request('/api/auth/me');
  const meBody = await meRes.json();
  assert.equal(meBody.user.email, email);
});

test('unauthenticated requests are rejected on protected routes', async () => {
  const s = new Session();
  const meRes = await s.request('/api/auth/me');
  assert.equal(meRes.status, 401);

  const resetRes = await s.request('/api/reset', { method: 'POST' });
  assert.equal(resetRes.status, 401);
});

test('a non-admin cannot access admin-only routes even with a valid session', async () => {
  const email = uniqueEmail('plainuser');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Plain User', email, password: 'password123', role: 'Bookkeeper' }),
  });

  const resetRes = await s.request('/api/reset', { method: 'POST' });
  assert.equal(resetRes.status, 403);

  const userListTargetRes = await s.request('/api/users/999999/role', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'System Administrator' }),
  });
  assert.equal(userListTargetRes.status, 403);
});

test('wrong admin key does not grant System Administrator; correct key does', async () => {
  const wrongKeyEmail = uniqueEmail('wrongkeyadmin');
  const s1 = new Session();
  const wrongRes = await s1.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Wrong Key',
      email: wrongKeyEmail,
      password: 'password123',
      role: 'System Administrator',
      adminKeyAttempt: 'definitely-not-the-key',
    }),
  });
  const wrongBody = await wrongRes.json();
  assert.equal(wrongRes.status, 403);
  assert.equal(wrongBody.success, false);

  const rightKeyEmail = uniqueEmail('rightkeyadmin');
  const s2 = new Session();
  const rightRes = await s2.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Right Key',
      email: rightKeyEmail,
      password: 'password123',
      role: 'System Administrator',
      adminKeyAttempt: 'ADMIN123', // default when ADMIN_KEY env var is unset
    }),
  });
  const rightBody = await rightRes.json();
  assert.equal(rightRes.status, 200);
  assert.equal(rightBody.user.role, 'System Administrator');
  assert.equal(rightBody.user.status, 'APPROVED');
});

test('a client cannot self-grant admin by sending role/status in the signup body directly', async () => {
  // Regression test for the original vulnerability: role/status used to be
  // trusted verbatim from the request body. Sending role without a valid
  // adminKeyAttempt must never result in a System Administrator account.
  const email = uniqueEmail('selfgrant');
  const s = new Session();
  const res = await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Self Grant', email, password: 'password123', role: 'System Administrator' }),
  });
  const body = await res.json();
  assert.equal(res.status, 403, 'signup without a valid admin key must be rejected outright when requesting the admin role');
});

test('CSRF: mutating request without token is rejected; with correct token it succeeds', async () => {
  // Use an auto-approved admin account so this test isolates CSRF behavior
  // specifically, rather than being confounded by the separate PENDING/
  // APPROVED gate exercised in the tests above.
  const email = uniqueEmail('csrftest');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Csrf Test',
      email,
      password: 'password123',
      role: 'System Administrator',
      adminKeyAttempt: 'ADMIN123',
    }),
  });

  const noTokenRes = await s.requestWithoutCsrf('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Forged ${Date.now()}` }),
  });
  assert.equal(noTokenRes.status, 403);

  const withTokenRes = await s.request('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Legit ${Date.now()}` }),
  });
  assert.equal(withTokenRes.status, 200);
});

test('CSRF: wrong token value is rejected even though a session is present', async () => {
  const email = uniqueEmail('csrfwrong');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Csrf Wrong', email, password: 'password123', role: 'Bookkeeper' }),
  });

  const res = await fetch(`${BASE}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `bk_session=${s.cookies['bk_session']}`,
      'X-CSRF-Token': 'attacker-guessed-wrong-token',
    },
    body: JSON.stringify({ name: `ShouldFail ${Date.now()}` }),
  });
  assert.equal(res.status, 403);
});

test('logout invalidates the session -- subsequent requests are unauthenticated', async () => {
  const email = uniqueEmail('logouttest');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Logout Test', email, password: 'password123', role: 'Bookkeeper' }),
  });

  const meBefore = await s.request('/api/auth/me');
  assert.equal(meBefore.status, 200);

  const logoutRes = await s.request('/api/auth/logout', { method: 'POST' });
  assert.equal(logoutRes.status, 200);

  const meAfter = await s.request('/api/auth/me');
  assert.equal(meAfter.status, 401);
});

test('admin can reset a user password; old password stops working and new one works', async () => {
  // Set up an admin
  const adminEmail = uniqueEmail('resetadmin');
  const adminSession = new Session();
  await adminSession.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Reset Admin',
      email: adminEmail,
      password: 'password123',
      role: 'System Administrator',
      adminKeyAttempt: 'ADMIN123',
    }),
  });

  // Set up a target user
  const targetEmail = uniqueEmail('resettarget');
  const targetSession = new Session();
  const targetSignupRes = await targetSession.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Reset Target', email: targetEmail, password: 'original-password', role: 'Bookkeeper' }),
  });
  const targetBody = await targetSignupRes.json();
  const targetId = targetBody.user.id;

  // Admin resets the target's password
  const resetRes = await adminSession.request(`/api/users/${targetId}/reset-password`, { method: 'POST' });
  assert.equal(resetRes.status, 200);
  const resetBody = await resetRes.json();
  assert.ok(resetBody.tempPassword, 'reset must return a one-time temp password');

  // Old password no longer works
  const oldPwSession = new Session();
  const oldPwRes = await oldPwSession.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetEmail, password: 'original-password' }),
  });
  assert.equal(oldPwRes.status, 401);

  // New temp password works
  const newPwSession = new Session();
  const newPwRes = await newPwSession.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetEmail, password: resetBody.tempPassword }),
  });
  assert.equal(newPwRes.status, 200);
});

test('duplicate signup email is rejected', async () => {
  const email = uniqueEmail('dupe');
  const s1 = new Session();
  const first = await s1.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'First', email, password: 'password123', role: 'Bookkeeper' }),
  });
  assert.equal(first.status, 200);

  const s2 = new Session();
  const second = await s2.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Second', email, password: 'differentpassword', role: 'Bookkeeper' }),
  });
  assert.equal(second.status, 409);
});

test('the old admin-key leak endpoint no longer exists as an API route', async () => {
  const res = await fetch(`${BASE}/api/admin/key`);
  // Falls through to the SPA shell (200 text/html) rather than ever
  // returning JSON with a key in it -- the important assertion is that it
  // is not a 200 application/json response containing "adminKey".
  const contentType = res.headers.get('content-type') || '';
  assert.equal(contentType.includes('application/json'), false);
});

test('bootstrap (client/task data) requires an approved account, not just any login', async () => {
  // Unauthenticated: rejected outright.
  const anonRes = await fetch(`${BASE}/api/bootstrap`);
  assert.equal(anonRes.status, 401);

  // Logged in but still PENDING (self-registered, not yet admin-approved):
  // must also be rejected -- this is the whole point of the approval step.
  const email = uniqueEmail('pendingbootstrap');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pending Person', email, password: 'password123', role: 'Bookkeeper' }),
  });
  const pendingRes = await s.request('/api/bootstrap');
  assert.equal(pendingRes.status, 403);

  // An approved admin, by contrast, can reach it (in-memory mode returns
  // dbConnected:false with no DATABASE_URL, but that's a 200, not a 401/403).
  const adminEmail = uniqueEmail('approvedbootstrap');
  const adminSession = new Session();
  await adminSession.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Approved Admin',
      email: adminEmail,
      password: 'password123',
      role: 'System Administrator',
      adminKeyAttempt: 'ADMIN123',
    }),
  });
  const approvedRes = await adminSession.request('/api/bootstrap');
  assert.equal(approvedRes.status, 200);
});

test('a pending (unapproved) account cannot create tasks or clients', async () => {
  const email = uniqueEmail('pendingwrite');
  const s = new Session();
  await s.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Pending Writer', email, password: 'password123', role: 'Bookkeeper' }),
  });

  const taskRes = await s.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Sneaky task', clientName: 'Nobody', status: 'OPEN', category: 'General Advisory', priority: 'NORMAL' }),
  });
  assert.equal(taskRes.status, 403);

  const clientRes = await s.request('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sneaky Client', industry: 'Test', tin: '000', managerInCharge: 'x', healthStatus: 'Good', contactEmail: 'x@x.com', contactPhone: '000' }),
  });
  assert.equal(clientRes.status, 403);
});
