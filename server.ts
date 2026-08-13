import express from "express";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { BIR_FILING_CALENDAR, computeUpcomingDueDates, findRuleForTaxType } from "./src/utils/birCalendar";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Trust the first hop of a reverse proxy (Render, etc.) so req.ip reflects
// the real client address instead of the proxy's address. Without this,
// every request behind a proxy looks like it comes from the same IP and
// the rate limiter below ends up sharing one bucket across all users.
app.set("trust proxy", 1);

// Security: Disable X-Powered-By header
app.disable("x-powered-by");

// Security: HTTP Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Content-Security-Policy: only enforced in production. The production
  // bundle (checked below) has no inline scripts, so this can be strict;
  // Vite's dev server injects inline HMR bootstrap scripts that a strict
  // CSP would break, so dev mode is left unrestricted.
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https://api.dicebear.com https://*.googleusercontent.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  next();
});

// Performance & Security: Restrict JSON payload size
app.use(express.json({ limit: "500kb" }));
app.use(cookieParser());

// Rate Limiter Store (In-Memory for performance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Disabled under the automated test suite (NODE_ENV=test) so a large
    // batch of rapid signups/logins in a single test run doesn't trip the
    // same protection meant for real credential-stuffing traffic. Still
    // fully active in development and production.
    if (process.env.NODE_ENV === "test") return next();

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down and try again shortly.",
      });
    }

    record.count++;
    next();
  };
}

// Rate limit API endpoints: 120 reqs/minute overall, 20 reqs/minute for AI,
// and a tighter limit on auth endpoints to slow down credential stuffing.
const generalApiLimiter = createRateLimiter(120, 60 * 1000);
const aiApiLimiter = createRateLimiter(20, 60 * 1000);
const authApiLimiter = createRateLimiter(15, 60 * 1000);

app.use("/api", generalApiLimiter);
app.use("/api/gemini", aiApiLimiter);
app.use("/api/auth/login", authApiLimiter);
app.use("/api/auth/signup", authApiLimiter);

// ---------------------------------------------------------------------------
// Auth: password hashing, sessions, and a storage backend that works both
// with Postgres (when DATABASE_URL is set) and purely in-memory (local dev
// without a database, matching how the rest of this app already degrades
// gracefully without DATABASE_URL). Every route that creates, edits, or
// deletes shared data is gated through requireAuth / requireAdmin below --
// nothing is authorized based on values the client sends in the request body.
// ---------------------------------------------------------------------------

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
  status: string;
  passwordHash: string | null;
  createdAt?: string;
}

const SESSION_COOKIE = "bk_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Double-submit CSRF cookie. This cookie is deliberately NOT httpOnly --
// the frontend reads it via document.cookie and echoes it back as the
// X-CSRF-Token header on every mutating request. A cross-site attacker
// page can trigger a request that carries the session cookie automatically,
// but it cannot read this cookie's value (browsers restrict document.cookie
// and response bodies to same-origin) to also set a matching header, so a
// forged cross-site request fails the comparison below.
const CSRF_COOKIE = "bk_csrf";

function issueCsrfToken(res: express.Response): string {
  const token = crypto.randomBytes(24).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
  return token;
}

function clearCsrfCookie(res: express.Response) {
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}

function sanitizeUser(u: AuthUser) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

// --- In-memory fallback store (used when DATABASE_URL is not configured) ---
let memUserSeq = 1;
const memUsers: AuthUser[] = [];
const memSessions = new Map<string, { userId: number; expiresAt: number }>();
let memCategories: string[] = [
  "VAT 2550Q",
  "Percentage Tax 2551Q",
  "Withholding Tax 1601-C",
  "Annual ITR 1702",
  "Expanded Withholding 0619-E",
  "Monthly Bookkeeping",
  "Payroll & SSS/HDMF",
  "Financial Audit",
  "Business Permit Renewal",
  "General Advisory",
];
interface MemDeadline {
  id: number;
  formCode: string;
  name: string;
  deadlineDate: string;
  description: string;
  status: string;
  clientId: number | null;
}
let memDeadlineSeq = 1;
const memDeadlines: MemDeadline[] = [];

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

const authBackend = {
  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const normalized = email.toLowerCase();
    if (!hasDb()) {
      return memUsers.find((u) => u.email.toLowerCase() === normalized) || null;
    }
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, normalized));
    return (rows[0] as any) || null;
  },

  async findUserById(id: number): Promise<AuthUser | null> {
    if (!hasDb()) {
      return memUsers.find((u) => u.id === id) || null;
    }
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id));
    return (rows[0] as any) || null;
  },

  async listUsers(): Promise<AuthUser[]> {
    if (!hasDb()) return memUsers.slice();
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const db = getDb();
    return (await db.select().from(users)) as any;
  },

  async createUser(data: {
    name: string;
    email: string;
    role: string;
    status: string;
    avatar: string;
    passwordHash: string;
  }): Promise<AuthUser> {
    if (!hasDb()) {
      const user: AuthUser = {
        id: memUserSeq++,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status,
        avatar: data.avatar,
        passwordHash: data.passwordHash,
        createdAt: new Date().toISOString(),
      };
      memUsers.push(user);
      return user;
    }
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const db = getDb();
    const [inserted] = await db.insert(users).values(data).returning();
    return inserted as any;
  },

  async updateUser(id: number, fields: Partial<AuthUser>): Promise<void> {
    if (!hasDb()) {
      const u = memUsers.find((x) => x.id === id);
      if (u) Object.assign(u, fields);
      return;
    }
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.update(users).set(fields as any).where(eq(users.id, id));
  },

  async deleteUser(id: number): Promise<void> {
    if (!hasDb()) {
      const idx = memUsers.findIndex((u) => u.id === id);
      if (idx >= 0) memUsers.splice(idx, 1);
      for (const [token, s] of memSessions) {
        if (s.userId === id) memSessions.delete(token);
      }
      return;
    }
    const { getDb } = await import("./src/db/index");
    const { users, sessions } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  },

  async createSession(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    if (!hasDb()) {
      memSessions.set(token, { userId, expiresAt: expiresAt.getTime() });
      return token;
    }
    const { getDb } = await import("./src/db/index");
    const { sessions } = await import("./src/db/schema");
    const db = getDb();
    await db.insert(sessions).values({ token, userId, expiresAt });
    return token;
  },

  async getSession(token: string): Promise<{ userId: number } | null> {
    if (!hasDb()) {
      const s = memSessions.get(token);
      if (!s) return null;
      if (s.expiresAt < Date.now()) {
        memSessions.delete(token);
        return null;
      }
      return { userId: s.userId };
    }
    const { getDb } = await import("./src/db/index");
    const { sessions } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const rows = await db.select().from(sessions).where(eq(sessions.token, token));
    const row = rows[0] as any;
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.token, token));
      return null;
    }
    return { userId: row.userId };
  },

  async deleteSession(token: string): Promise<void> {
    if (!hasDb()) {
      memSessions.delete(token);
      return;
    }
    const { getDb } = await import("./src/db/index");
    const { sessions } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.token, token));
  },
};

// Populates req.currentUser (sanitized, no password hash) from the session
// cookie if present and valid. Does not reject the request either way --
// use requireAuth / requireAdmin for that.
async function attachUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next();
    const session = await authBackend.getSession(token);
    if (!session) return next();
    const user = await authBackend.findUserById(session.userId);
    if (user) {
      (req as any).currentUser = sanitizeUser(user);
    }
  } catch (err) {
    // Fail open on lookup errors -- request just proceeds unauthenticated.
  }
  next();
}
app.use(attachUser);

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!(req as any).currentUser) {
    return res.status(401).json({ success: false, error: "Please sign in to continue." });
  }
  next();
}

// A logged-in account whose signup hasn't been approved by an admin yet
// (self-registered PENDING users) can see their own pending-approval banner
// and account settings, but must not be able to read or write firm data --
// client TINs, contact info, notes, and task detail are exactly what an
// admin approval step exists to gate. requireAuth alone is not enough for
// anything that touches client/task/firm data.
function requireApproved(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).currentUser;
  if (!user) {
    return res.status(401).json({ success: false, error: "Please sign in to continue." });
  }
  if (user.status !== "APPROVED") {
    return res.status(403).json({ success: false, error: "Your account is still awaiting System Administrator approval." });
  }
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as any).currentUser;
  if (!user) {
    return res.status(401).json({ success: false, error: "Please sign in to continue." });
  }
  if (user.role !== "System Administrator" || user.status !== "APPROVED") {
    return res.status(403).json({ success: false, error: "System Administrator access required." });
  }
  next();
}

// Double-submit CSRF check for state-changing requests. Only enforced once
// a session cookie is present -- unauthenticated mutations (signup/login
// themselves) are rejected on their own terms and don't have a CSRF cookie
// yet anyway. Applied globally to /api so no route can be added later
// without this protection by accident.
const CSRF_EXEMPT_PATHS = new Set(["/api/auth/login", "/api/auth/signup"]);
function requireCsrf(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (CSRF_EXEMPT_PATHS.has(req.path)) return next();

  const sessionToken = req.cookies?.[SESSION_COOKIE];
  if (!sessionToken) return next(); // no session -> requireAuth below will 401 anyway

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, error: "Invalid or missing CSRF token. Please refresh and try again." });
  }
  next();
}
app.use("/api", requireCsrf);

// Periodically purge expired sessions so the store doesn't grow forever.
// Runs both against Postgres (when configured) and the in-memory fallback.
setInterval(async () => {
  try {
    if (hasDb()) {
      const { getDb } = await import("./src/db/index");
      const { sessions } = await import("./src/db/schema");
      const { lt } = await import("drizzle-orm");
      const db = getDb();
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    } else {
      const now = Date.now();
      for (const [token, s] of memSessions) {
        if (s.expiresAt < now) memSessions.delete(token);
      }
    }
  } catch (err) {
    console.error("Session cleanup error:", err);
  }
}, 60 * 60 * 1000); // hourly

// --- Admin master key (for self-service System Administrator signup) ------
// Stored as a bcrypt hash server-side only. It is never sent back to the
// client -- signup verifies the attempt against the hash server-side.
let systemAdminMasterKeyHash = bcrypt.hashSync(process.env.ADMIN_KEY || "ADMIN123", 10);
let publicAdminRegLocked = false;

// --- Auth routes ------------------------------------------------------------

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role, adminKeyAttempt } = req.body || {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Please provide your full name." });
    }
    if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Please enter a valid work email address." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await authBackend.findUserByEmail(normalizedEmail);

    // Accounts that existed before real authentication was added (e.g. from
    // the old fake-login system, or seeded via TEAM_USERS) have no password
    // hash at all -- login correctly rejects those, but without this,
    // signup would too, permanently locking that person out of an identity
    // they already own. If the existing row has no password set yet, treat
    // this as "claiming" that account by setting its first real password,
    // rather than as a brand new duplicate signup.
    if (existing && !existing.passwordHash) {
      const passwordHash = await bcrypt.hash(password, 10);
      const updates: { passwordHash: string; role?: string; status?: string } = { passwordHash };

      // Only ever elevates, never downgrades: if they're claiming with a
      // valid admin key, grant admin; otherwise the account keeps whatever
      // role/status it already had (commonly already an admin from the old
      // system, which this preserves as-is).
      const wantsAdminClaim = role === "System Administrator" && !publicAdminRegLocked;
      if (wantsAdminClaim) {
        const attempt = typeof adminKeyAttempt === "string" ? adminKeyAttempt.trim() : "";
        const keyOk = attempt.length > 0 && (await bcrypt.compare(attempt, systemAdminMasterKeyHash));
        if (keyOk) {
          updates.role = "System Administrator";
          updates.status = "APPROVED";
        }
      }

      await authBackend.updateUser(existing.id, updates);
      const claimed = await authBackend.findUserById(existing.id);
      const token = await authBackend.createSession(claimed!.id);
      setSessionCookie(res, token);
      issueCsrfToken(res);
      return res.json({ success: true, user: sanitizeUser(claimed!), claimed: true });
    }

    if (existing) {
      return res.status(409).json({ success: false, error: "An account with this email already exists. Please log in." });
    }

    const ALLOWED_ROLES = [
      "Bookkeeper",
      "Accounting Associate",
      "Admin Officer",
      "Staff Auditor",
      "Tax Specialist",
      "Senior CPA",
      "Manager",
      "System Administrator",
    ];
    const requestedRole = ALLOWED_ROLES.includes(role) ? role : "Bookkeeper";
    const wantsAdmin = requestedRole === "System Administrator";

    let finalRole = wantsAdmin ? "Bookkeeper" : requestedRole;
    let finalStatus = "PENDING";

    if (wantsAdmin) {
      if (publicAdminRegLocked) {
        return res.status(403).json({
          success: false,
          error: "System Administrator self-registration is locked. Ask an existing admin to add you from the Admin Hub.",
        });
      }
      const attempt = typeof adminKeyAttempt === "string" ? adminKeyAttempt.trim() : "";
      const keyOk = attempt.length > 0 && (await bcrypt.compare(attempt, systemAdminMasterKeyHash));
      if (!keyOk) {
        return res.status(403).json({ success: false, error: "Invalid Admin Security Key." });
      }
      finalRole = "System Administrator";
      finalStatus = "APPROVED";
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    const user = await authBackend.createUser({
      name: name.trim(),
      email: normalizedEmail,
      role: finalRole,
      status: finalStatus,
      avatar,
      passwordHash,
    });

    const token = await authBackend.createSession(user.id);
    setSessionCookie(res, token);
    issueCsrfToken(res);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, error: "Failed to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      return res.status(400).json({ success: false, error: "Please enter both your email address and password." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await authBackend.findUserByEmail(normalizedEmail);

    // Deliberately generic error for wrong-password cases -- never reveal
    // whether an email exists via a differently-worded message. This one
    // case is an intentional exception: an account with no password hash
    // at all is a pre-migration account (from before real auth existed)
    // that needs to be claimed via signup, not a wrong-password situation --
    // telling them that directly is the difference between "locked out
    // permanently" and "oh, I need to use Create Account instead."
    if (user && !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: "This account hasn't set a password yet (it predates password-based login). Use \"Create Account\" with this same email to set one -- your existing role will be preserved.",
      });
    }

    const invalidCreds = { success: false, error: "Invalid email or password." };
    if (!user) {
      return res.status(401).json(invalidCreds);
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json(invalidCreds);
    }

    const token = await authBackend.createSession(user.id);
    setSessionCookie(res, token);
    issueCsrfToken(res);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed. Please try again." });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) await authBackend.deleteSession(token);
  } catch (err) {
    // ignore
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  clearCsrfCookie(res);
  res.json({ success: true });
});

app.get("/api/auth/me", (req, res) => {
  const user = (req as any).currentUser;
  if (!user) return res.status(401).json({ success: false });
  res.json({ success: true, user });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters long." });
    }
    const currentUser = (req as any).currentUser;
    const fullUser = await authBackend.findUserById(currentUser.id);
    if (!fullUser || !fullUser.passwordHash) {
      return res.status(400).json({ success: false, error: "Account has no password set. Contact an administrator." });
    }
    const ok = typeof currentPassword === "string" && (await bcrypt.compare(currentPassword, fullUser.passwordHash));
    if (!ok) {
      return res.status(401).json({ success: false, error: "Current password is incorrect." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await authBackend.updateUser(fullUser.id, { passwordHash });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, error: "Failed to change password." });
  }
});

// Public: only exposes whether self-registration as admin is locked --
// never the key itself.
app.get("/api/auth/admin-reg-status", (_req, res) => {
  res.json({ success: true, locked: publicAdminRegLocked });
});

// Admin-only: rotate the master signup key and/or lock self-registration.
// The new key is never echoed back.
app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const { newKey, locked } = req.body || {};
    if (typeof locked === "boolean") {
      publicAdminRegLocked = locked;
    }
    if (typeof newKey === "string" && newKey.trim().length >= 4) {
      systemAdminMasterKeyHash = await bcrypt.hash(newKey.trim(), 10);
    }
    res.json({ success: true, locked: publicAdminRegLocked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to update admin settings." });
  }
});

// Admin-only: directly provision a team member account. Returns a one-time
// temporary password for the admin to relay out-of-band; the new hire
// should change it via /api/auth/change-password after first login.
app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { name, email, role } = req.body || {};
    if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Name and email are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await authBackend.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ success: false, error: "An account with this email already exists." });
    }
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;
    const user = await authBackend.createUser({
      name: name.trim(),
      email: normalizedEmail,
      role: typeof role === "string" && role ? role : "Bookkeeper",
      status: "APPROVED",
      avatar,
      passwordHash,
    });
    res.json({ success: true, user: sanitizeUser(user), tempPassword });
  } catch (err: any) {
    console.error("Admin create user error:", err);
    res.status(500).json({ success: false, error: "Failed to create user." });
  }
});

app.put("/api/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (typeof role !== "string" || !role) {
      return res.status(400).json({ success: false, error: "role is required" });
    }
    await authBackend.updateUser(Number(req.params.id), { role });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/users/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (typeof status !== "string" || !status) {
      return res.status(400).json({ success: false, error: "status is required" });
    }
    await authBackend.updateUser(Number(req.params.id), { status });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    await authBackend.deleteUser(Number(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: reset a user's password without needing email delivery
// infrastructure. Generates a new one-time temp password, returned once for
// the admin to relay out-of-band; the user should change it after login via
// /api/auth/change-password. This is the recovery path for this app in lieu
// of a self-service "forgot password" email flow (no email provider is
// configured), and mirrors the same one-time-reveal pattern used when an
// admin provisions a brand new account.
app.post("/api/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const target = await authBackend.findUserById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await authBackend.updateUser(targetId, { passwordHash });
    res.json({ success: true, tempPassword });
  } catch (err: any) {
    console.error("Admin reset password error:", err);
    res.status(500).json({ success: false, error: "Failed to reset password." });
  }
});

// Initialize Gemini Client server-side
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Route for Gemini CPA & Tax Assistance
app.post("/api/gemini/assist", requireApproved, async (req, res) => {
  try {
    const { action, prompt, context } = req.body;
    const ai = getGeminiClient();

    let systemInstruction = "You are an expert CPA (Certified Public Accountant) and Tax Advisor assistant for an internal accounting firm team collaboration platform. Provide concise, accurate, professional, and practical advice tailored for bookkeepers, auditors, and tax specialists.";

    let userPrompt = "";

    if (action === "draft_update") {
      userPrompt = `Draft a concise, professional accounting update post for the team feed based on these details:
Client: ${context?.clientName || "Client"}
Title/Topic: ${context?.title || "Filing Update"}
Category: ${context?.category || "General Bookkeeping"}
Notes: ${prompt || "Routine progress update"}

Provide a clean, bulleted or short paragraph draft suitable for posting on the accounting team feed.`;
    } else if (action === "tax_checklist") {
      userPrompt = `Provide a short 3-5 point compliance checklist and required supporting documents for filing/handling "${prompt || context?.category || "VAT Return 2550Q"}". Keep it actionable for a staff auditor or bookkeeper.`;
    } else if (action === "roadblock_resolution") {
      userPrompt = `A staff member flagged a roadblock for client "${context?.clientName || "Client"}":
Task: "${context?.title || "Tax Filing"}"
Roadblock Reason: "${prompt || context?.flagReason || "Missing supporting documents"}"

Provide 2-3 step actionable advice for the accounting manager/staff to resolve this blocker, plus a short, polite text template to send to the client.`;
    } else if (action === "draft_client_email") {
      userPrompt = `Draft a polite, firm, and formal email or letter to the client requesting missing tax documents or reminding them of an upcoming tax deadline:
Client Name: ${context?.clientName || "Client"}
Contact Email: ${context?.contactEmail || "finance@gmail.com"}
Category / Subject: ${context?.category || context?.title || "Tax Document Request"}
Specific Items Required: ${prompt || "Monthly Sales & Expense Ledger, BIR 2307, Bank Statements"}
Target Deadline: ${context?.dueDate || "End of week"}

Include a professional Subject Line and Email Body ready to copy and send.`;
    } else if (action === "feed_summary") {
      userPrompt = `Summarize the current status of these accounting tasks for the team manager:
${JSON.stringify(context?.tasks || [], null, 2)}

Highlight:
1. Key progress made
2. Critical flagged roadblocks requiring manager attention
3. Urgent upcoming tax deadlines.
Keep it structured with bullet points.`;
    } else {
      userPrompt = prompt || "How can I assist with tax compliance or bookkeeping tasks today?";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ success: true, text: response.text });
  } catch (err: any) {
    console.error("Gemini API error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to generate AI response" });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "Accounting Portal",
    hasDatabase: Boolean(process.env.DATABASE_URL)
  });
});

app.get("/api/db/status", async (_req, res) => {
  try {
    const { getDb, ensureTablesExist } = await import("./src/db/index");
    await ensureTablesExist();
    res.json({ connected: true, provider: "PostgreSQL Database" });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// Bootstrap endpoint to load initial state or seed PostgreSQL database
app.get("/api/bootstrap", requireApproved, async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({ success: true, dbConnected: false });
  }

  try {
    const { getDb, ensureTablesExist } = await import("./src/db/index");
    const { users, clients, tasks, taxDeadlines } = await import("./src/db/schema");
    const { TEAM_USERS, INITIAL_CLIENTS, INITIAL_TASKS, INITIAL_DEADLINES } = await import("./src/data/initialData");

    await ensureTablesExist();
    const db = getDb();

    let dbUsers = await db.select().from(users);
    let dbClients = await db.select().from(clients);
    let dbTasks = await db.select().from(tasks);
    let dbDeadlines = await db.select().from(taxDeadlines);

    // Seed if empty (TEAM_USERS has no passwords -- real accounts are only
    // ever created through /api/auth/signup or /api/admin/users now)
    if (dbUsers.length === 0 && TEAM_USERS.length > 0) {
      for (const u of TEAM_USERS as any[]) {
        await db.insert(users).values({
          id: u.id,
          name: u.name,
          role: u.role,
          avatar: u.avatar,
          email: u.email,
          status: 'APPROVED'
        }).onConflictDoNothing();
      }
      dbUsers = await db.select().from(users);
    }

    if (dbClients.length === 0) {
      for (const c of INITIAL_CLIENTS) {
        await db.insert(clients).values({
          id: c.id,
          name: c.name,
          industry: c.industry,
          tin: c.tin,
          activeEngagementsCount: c.activeEngagementsCount,
          managerInCharge: c.managerInCharge,
          healthStatus: c.healthStatus,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          notes: c.notes,
          rdoCode: c.rdoCode,
          entityType: c.entityType || 'Corporation',
          secDtiNumber: c.secDtiNumber,
          taxRegistrationType: c.taxRegistrationType,
          applicableTaxesJson: c.applicableTaxes || [],
          contactPerson: c.contactPerson,
          registeredAddress: c.registeredAddress,
          accountingMethod: c.accountingMethod,
          fiscalYearEnd: c.fiscalYearEnd,
          subscribedServicesJson: c.subscribedServices || [],
        }).onConflictDoNothing();
      }
      dbClients = await db.select().from(clients);
    }

    if (dbTasks.length === 0) {
      for (const t of INITIAL_TASKS) {
        await db.insert(tasks).values({
          id: t.id,
          title: t.title,
          clientName: t.clientName,
          description: t.description,
          status: t.status,
          category: t.category,
          priority: t.priority,
          dueDate: t.dueDate,
          flagged: t.flagged,
          flagReason: t.flagReason,
          flagDate: t.flagDate,
          creatorJson: t.creator as any,
          assigneeJson: t.assignee as any,
          commentsJson: (t.comments || []) as any,
          reactionsJson: (t.reactions || {}) as any,
          auditLogJson: (t.auditLog || []) as any,
          attachmentsJson: (t.attachments || []) as any,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }).onConflictDoNothing();
      }
      dbTasks = await db.select().from(tasks);
    }

    if (dbDeadlines.length === 0) {
      for (const d of INITIAL_DEADLINES) {
        await db.insert(taxDeadlines).values({
          id: d.id,
          formCode: d.formCode,
          name: d.name,
          deadlineDate: d.deadlineDate,
          description: d.description,
          status: d.status
        }).onConflictDoNothing();
      }
      dbDeadlines = await db.select().from(taxDeadlines);
    }

    // Format tasks to match frontend interface
    const formattedTasks = dbTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      clientName: t.clientName,
      description: t.description,
      status: t.status,
      category: t.category,
      priority: t.priority,
      dueDate: t.dueDate,
      flagged: t.flagged,
      flagReason: t.flagReason,
      flagDate: t.flagDate,
      creator: t.creatorJson,
      assignee: t.assigneeJson,
      comments: t.commentsJson || [],
      reactions: t.reactionsJson || {},
      auditLog: t.auditLogJson || [],
      attachments: t.attachmentsJson || [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }));

    const formattedClients = dbClients.map((c: any) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      tin: c.tin,
      activeEngagementsCount: c.activeEngagementsCount,
      managerInCharge: c.managerInCharge,
      healthStatus: c.healthStatus,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      notes: c.notes,
      rdoCode: c.rdoCode,
      entityType: c.entityType || 'Corporation',
      secDtiNumber: c.secDtiNumber,
      taxRegistrationType: c.taxRegistrationType,
      applicableTaxes: c.applicableTaxesJson || [],
      contactPerson: c.contactPerson,
      registeredAddress: c.registeredAddress,
      accountingMethod: c.accountingMethod,
      fiscalYearEnd: c.fiscalYearEnd,
      subscribedServices: c.subscribedServicesJson || [],
    }));

    res.json({
      success: true,
      dbConnected: true,
      users: dbUsers.map((u: any) => sanitizeUser(u)),
      clients: formattedClients,
      tasks: formattedTasks,
      deadlines: dbDeadlines
    });
  } catch (err: any) {
    console.error("Bootstrap database notice:", err.message);
    const isRenderInternal = process.env.DATABASE_URL?.includes('dpg-') && !process.env.DATABASE_URL?.includes('.render.com');
    const hint = isRenderInternal
      ? "DATABASE_URL appears to be a Render internal hostname (dpg-...). For external connections outside Render, use Render's External Database URL (ending in .render.com)."
      : err.message;

    res.json({
      success: true,
      dbConnected: false,
      warning: hint
    });
  }
});

// Sync/Save Task
app.post("/api/tasks", requireApproved, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { tasks } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const t = req.body;

    if (t.id) {
      const existing = await db.select().from(tasks).where(eq(tasks.id, t.id));
      if (existing.length > 0) {
        await db.update(tasks).set({
          title: t.title,
          clientName: t.clientName,
          description: t.description,
          status: t.status,
          category: t.category,
          priority: t.priority,
          dueDate: t.dueDate,
          flagged: Boolean(t.flagged),
          flagReason: t.flagReason,
          flagDate: t.flagDate,
          creatorJson: t.creator as any,
          assigneeJson: t.assignee as any,
          commentsJson: (t.comments || []) as any,
          reactionsJson: (t.reactions || {}) as any,
          auditLogJson: (t.auditLog || []) as any,
          attachmentsJson: (t.attachments || []) as any,
          updatedAt: t.updatedAt || new Date().toISOString()
        }).where(eq(tasks.id, t.id));
        return res.json({ success: true, taskId: t.id });
      }
    }

    const [inserted] = await db.insert(tasks).values({
      title: t.title,
      clientName: t.clientName,
      description: t.description,
      status: t.status,
      category: t.category,
      priority: t.priority,
      dueDate: t.dueDate,
      flagged: Boolean(t.flagged),
      flagReason: t.flagReason,
      flagDate: t.flagDate,
      creatorJson: t.creator as any,
      assigneeJson: t.assignee as any,
      commentsJson: (t.comments || []) as any,
      reactionsJson: (t.reactions || {}) as any,
      auditLogJson: (t.auditLog || []) as any,
      attachmentsJson: (t.attachments || []) as any,
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || new Date().toISOString()
    }).returning();

    res.json({ success: true, taskId: inserted.id });
  } catch (err: any) {
    console.error("Save task error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Task
app.delete("/api/tasks/:id", requireApproved, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { tasks } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(tasks).where(eq(tasks.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync Client
app.post("/api/clients", requireApproved, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { clients } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const c = req.body;

    const values = {
      name: c.name,
      industry: c.industry,
      tin: c.tin,
      activeEngagementsCount: c.activeEngagementsCount || 0,
      managerInCharge: c.managerInCharge,
      healthStatus: c.healthStatus,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      notes: c.notes || '',
      rdoCode: c.rdoCode || '',
      entityType: c.entityType || 'Corporation',
      secDtiNumber: c.secDtiNumber || '',
      taxRegistrationType: c.taxRegistrationType || '',
      applicableTaxesJson: c.applicableTaxes || [],
      contactPerson: c.contactPerson || '',
      registeredAddress: c.registeredAddress || '',
      accountingMethod: c.accountingMethod || '',
      fiscalYearEnd: c.fiscalYearEnd || '',
      subscribedServicesJson: c.subscribedServices || [],
    };

    // Upsert by id when the caller supplies one that already exists (e.g.
    // restoring a JSON backup) -- otherwise this would insert a fresh
    // duplicate row with a new id every time the same backup is imported.
    let result: any;
    if (c.id) {
      const existing = await db.select().from(clients).where(eq(clients.id, c.id));
      if (existing.length > 0) {
        const [updated] = await db.update(clients).set(values).where(eq(clients.id, c.id)).returning();
        result = updated;
      }
    }
    if (!result) {
      const [inserted] = await db.insert(clients).values(values).returning();
      result = inserted;
    }

    const formatted = {
      ...result,
      applicableTaxes: result.applicableTaxesJson || [],
      subscribedServices: result.subscribedServicesJson || []
    };
    res.json({ success: true, client: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Client Info/Notes/Health
app.put("/api/clients/:id", requireApproved, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { clients } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const c = req.body;
    await db.update(clients).set({
      ...(c.notes !== undefined ? { notes: c.notes } : {}),
      ...(c.healthStatus ? { healthStatus: c.healthStatus } : {}),
      ...(c.name ? { name: c.name } : {}),
      ...(c.industry ? { industry: c.industry } : {}),
      ...(c.tin ? { tin: c.tin } : {}),
      ...(c.contactEmail !== undefined ? { contactEmail: c.contactEmail } : {}),
      ...(c.contactPhone !== undefined ? { contactPhone: c.contactPhone } : {}),
      ...(c.managerInCharge !== undefined ? { managerInCharge: c.managerInCharge } : {}),
      ...(c.rdoCode !== undefined ? { rdoCode: c.rdoCode } : {}),
      ...(c.entityType !== undefined ? { entityType: c.entityType } : {}),
      ...(c.secDtiNumber !== undefined ? { secDtiNumber: c.secDtiNumber } : {}),
      ...(c.taxRegistrationType !== undefined ? { taxRegistrationType: c.taxRegistrationType } : {}),
      ...(c.applicableTaxes !== undefined ? { applicableTaxesJson: c.applicableTaxes } : {}),
      ...(c.contactPerson !== undefined ? { contactPerson: c.contactPerson } : {}),
      ...(c.registeredAddress !== undefined ? { registeredAddress: c.registeredAddress } : {}),
      ...(c.accountingMethod !== undefined ? { accountingMethod: c.accountingMethod } : {}),
      ...(c.fiscalYearEnd !== undefined ? { fiscalYearEnd: c.fiscalYearEnd } : {}),
      ...(c.subscribedServices !== undefined ? { subscribedServicesJson: c.subscribedServices } : {}),
    }).where(eq(clients.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Client
app.delete("/api/clients/:id", requireApproved, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { clients } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(clients).where(eq(clients.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Task Categories (persisted; falls back to in-memory demo list only
// when no DATABASE_URL is configured, same degrade pattern as everything
// else in this file) ---------------------------------------------------

async function getCategories(): Promise<string[]> {
  if (!hasDb()) return memCategories.slice();
  const { getDb } = await import("./src/db/index");
  const { taskCategories } = await import("./src/db/schema");
  const db = getDb();
  const rows = await db.select().from(taskCategories);
  if (rows.length === 0) {
    for (const name of memCategories) {
      await db.insert(taskCategories).values({ name }).onConflictDoNothing();
    }
    return memCategories.slice();
  }
  return rows.map((r: any) => r.name);
}

app.get("/api/categories", async (_req, res) => {
  try {
    const categories = await getCategories();
    res.json({ success: true, categories });
  } catch (err: any) {
    res.json({ success: true, categories: memCategories.slice() });
  }
});

app.post("/api/categories", requireApproved, async (req, res) => {
  const { name } = req.body || {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ success: false, error: "Category name is required" });
  }
  const trimmed = name.trim();
  try {
    if (!hasDb()) {
      if (!memCategories.includes(trimmed)) memCategories.push(trimmed);
      return res.json({ success: true, categories: memCategories.slice() });
    }
    const { getDb } = await import("./src/db/index");
    const { taskCategories } = await import("./src/db/schema");
    const db = getDb();
    await db.insert(taskCategories).values({ name: trimmed }).onConflictDoNothing();
    res.json({ success: true, categories: await getCategories() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/categories/:name", requireAdmin, async (req, res) => {
  const nameToDelete = decodeURIComponent(req.params.name);
  try {
    if (!hasDb()) {
      memCategories = memCategories.filter((c) => c !== nameToDelete);
      return res.json({ success: true, categories: memCategories.slice() });
    }
    const { getDb } = await import("./src/db/index");
    const { taskCategories } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(taskCategories).where(eq(taskCategories.name, nameToDelete));
    res.json({ success: true, categories: await getCategories() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Tax Deadlines (the Tax Compliance Calendar ticker previously had no
// way to be populated -- this gives it a real backing store + CRUD) -----

app.get("/api/deadlines", async (_req, res) => {
  try {
    if (!hasDb()) return res.json({ success: true, deadlines: memDeadlines.slice() });
    const { getDb } = await import("./src/db/index");
    const { taxDeadlines } = await import("./src/db/schema");
    const db = getDb();
    const rows = await db.select().from(taxDeadlines);
    res.json({ success: true, deadlines: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/deadlines", requireApproved, async (req, res) => {
  try {
    const { formCode, name, deadlineDate, description, status, clientId } = req.body || {};
    if (!formCode || !name || !deadlineDate) {
      return res.status(400).json({ success: false, error: "formCode, name, and deadlineDate are required." });
    }
    const record = {
      formCode: String(formCode),
      name: String(name),
      deadlineDate: String(deadlineDate),
      description: String(description || ""),
      status: String(status || "Upcoming"),
      clientId: clientId != null ? Number(clientId) : null,
    };
    if (!hasDb()) {
      const created = { id: memDeadlineSeq++, ...record };
      memDeadlines.push(created);
      return res.json({ success: true, deadline: created });
    }
    const { getDb } = await import("./src/db/index");
    const { taxDeadlines } = await import("./src/db/schema");
    const db = getDb();
    const [inserted] = await db.insert(taxDeadlines).values(record).returning();
    res.json({ success: true, deadline: inserted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/deadlines/:id", requireApproved, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { formCode, name, deadlineDate, description, status, clientId } = req.body || {};
    const fields: Record<string, string | number | null> = {};
    if (formCode !== undefined) fields.formCode = String(formCode);
    if (name !== undefined) fields.name = String(name);
    if (deadlineDate !== undefined) fields.deadlineDate = String(deadlineDate);
    if (description !== undefined) fields.description = String(description);
    if (status !== undefined) fields.status = String(status);
    if (clientId !== undefined) fields.clientId = clientId != null ? Number(clientId) : null;

    if (!hasDb()) {
      const d = memDeadlines.find((x) => x.id === id);
      if (d) Object.assign(d, fields);
      return res.json({ success: true });
    }
    const { getDb } = await import("./src/db/index");
    const { taxDeadlines } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.update(taxDeadlines).set(fields).where(eq(taxDeadlines.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/deadlines/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!hasDb()) {
      const idx = memDeadlines.findIndex((d) => d.id === id);
      if (idx >= 0) memDeadlines.splice(idx, 1);
      return res.json({ success: true });
    }
    const { getDb } = await import("./src/db/index");
    const { taxDeadlines } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(taxDeadlines).where(eq(taxDeadlines.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear / Reset all demo data tables -- destructive, admin only.
app.post("/api/reset", requireAdmin, async (_req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { tasks, clients, taxDeadlines } = await import("./src/db/schema");
    const db = getDb();
    await db.delete(tasks);
    await db.delete(clients);
    await db.delete(taxDeadlines);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      maxAge: "1d",
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        }
      }
    }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Accounting Portal] Server running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown: platforms like Render send SIGTERM before killing a
  // container during a deploy or scale-down. Without handling it, in-flight
  // requests get dropped mid-response and Postgres connections are left
  // dangling until they time out. This stops accepting new connections,
  // lets existing ones finish, then closes the DB pool cleanly.
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Accounting Portal] Received ${signal}, shutting down gracefully...`);
    const forceExitTimer = setTimeout(() => {
      console.error("[Accounting Portal] Graceful shutdown timed out, forcing exit.");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    server.close(async (err) => {
      if (err) console.error("[Accounting Portal] Error closing HTTP server:", err);
      try {
        const { closeDb } = await import("./src/db/index");
        await closeDb();
      } catch (dbErr) {
        console.error("[Accounting Portal] Error closing database connection:", dbErr);
      }
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
