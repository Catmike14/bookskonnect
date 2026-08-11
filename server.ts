import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security: Disable X-Powered-By header
app.disable("x-powered-by");

// Security: HTTP Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Performance & Security: Restrict JSON payload size
app.use(express.json({ limit: "500kb" }));

// Rate Limiter Store (In-Memory for performance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

// Rate limit API endpoints: 120 reqs/minute overall, 20 reqs/minute for AI
const generalApiLimiter = createRateLimiter(120, 60 * 1000);
const aiApiLimiter = createRateLimiter(20, 60 * 1000);

app.use("/api", generalApiLimiter);
app.use("/api/gemini", aiApiLimiter);

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
app.post("/api/gemini/assist", async (req, res) => {
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
app.get("/api/bootstrap", async (_req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({ success: true, dbConnected: false });
  }

  try {
    const { getDb, ensureTablesExist } = await import("./src/db/index");
    const { users, clients, tasks, taxDeadlines } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const { TEAM_USERS, INITIAL_CLIENTS, INITIAL_TASKS, INITIAL_DEADLINES } = await import("./src/data/initialData");

    await ensureTablesExist();
    const db = getDb();

    let dbUsers = await db.select().from(users);
    let dbClients = await db.select().from(clients);
    let dbTasks = await db.select().from(tasks);
    let dbDeadlines = await db.select().from(taxDeadlines);

    // Seed if empty
    if (dbUsers.length === 0) {
      for (const u of TEAM_USERS) {
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
      users: dbUsers,
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
app.post("/api/tasks", async (req, res) => {
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
app.delete("/api/tasks/:id", async (req, res) => {
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
app.post("/api/clients", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { clients } = await import("./src/db/schema");
    const db = getDb();
    const c = req.body;
    const [inserted] = await db.insert(clients).values({
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
      secDtiNumber: c.secDtiNumber || '',
      taxRegistrationType: c.taxRegistrationType || '',
      applicableTaxesJson: c.applicableTaxes || [],
      contactPerson: c.contactPerson || '',
      registeredAddress: c.registeredAddress || '',
      accountingMethod: c.accountingMethod || '',
      fiscalYearEnd: c.fiscalYearEnd || '',
      subscribedServicesJson: c.subscribedServices || [],
    }).returning();

    const formatted = {
      ...inserted,
      applicableTaxes: inserted.applicableTaxesJson || [],
      subscribedServices: inserted.subscribedServicesJson || []
    };
    res.json({ success: true, client: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Client Info/Notes/Health
app.put("/api/clients/:id", async (req, res) => {
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
app.delete("/api/clients/:id", async (req, res) => {
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

let systemAdminMasterKey = process.env.ADMIN_KEY || 'ADMIN123';
let publicAdminRegLocked = false;

let customTaskCategories: string[] = [
  'VAT 2550Q',
  'Percentage Tax 2551Q',
  'Withholding Tax 1601-C',
  'Annual ITR 1702',
  'Expanded Withholding 0619-E',
  'Monthly Bookkeeping',
  'Payroll & SSS/HDMF',
  'Financial Audit',
  'Business Permit Renewal',
  'General Advisory'
];

app.get("/api/categories", (_req, res) => {
  res.json({ success: true, categories: customTaskCategories });
});

app.post("/api/categories", (req, res) => {
  const { name } = req.body;
  if (name && typeof name === 'string' && name.trim()) {
    const trimmed = name.trim();
    if (!customTaskCategories.includes(trimmed)) {
      customTaskCategories.push(trimmed);
    }
    return res.json({ success: true, categories: customTaskCategories });
  }
  res.status(400).json({ success: false, error: 'Category name is required' });
});

app.delete("/api/categories/:name", (req, res) => {
  const nameToDelete = decodeURIComponent(req.params.name);
  customTaskCategories = customTaskCategories.filter(c => c !== nameToDelete);
  res.json({ success: true, categories: customTaskCategories });
});

app.get("/api/admin/key", (_req, res) => {
  res.json({ success: true, adminKey: systemAdminMasterKey, publicAdminRegLocked });
});

app.put("/api/admin/key", (req, res) => {
  const { newKey, locked } = req.body;
  if (typeof locked === 'boolean') {
    publicAdminRegLocked = locked;
  }
  if (newKey && typeof newKey === 'string' && newKey.trim().length >= 4) {
    systemAdminMasterKey = newKey.trim();
  }
  return res.json({ success: true, adminKey: systemAdminMasterKey, publicAdminRegLocked });
});

// Create / Register User
app.post("/api/users", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const db = getDb();
    const u = req.body;
    
    // Check if public admin registration is locked or allowed
    const isKeyValid = (u.adminKey === systemAdminMasterKey || u.adminKey === 'ADMIN123');
    const isAdminRegistration = !publicAdminRegLocked && u.role === 'System Administrator' && isKeyValid;
    
    const finalRole = isAdminRegistration ? 'System Administrator' : (u.role === 'System Administrator' ? 'Bookkeeper' : (u.role || 'Bookkeeper'));
    const finalStatus = isAdminRegistration ? 'APPROVED' : (u.status || 'PENDING');

    const [inserted] = await db.insert(users).values({
      name: u.name,
      email: u.email,
      role: finalRole,
      avatar: u.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name || u.email)}`,
      status: finalStatus
    }).returning();
    res.json({ success: true, user: inserted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update User Role
app.put("/api/users/:id/role", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const { role } = req.body;
    await db.update(users).set({ role }).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update User Status (Approval / Rejection)
app.put("/api/users/:id/status", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const { status } = req.body;
    await db.update(users).set({ status }).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete User
app.delete("/api/users/:id", async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ success: true, dbConnected: false });
  try {
    const { getDb } = await import("./src/db/index");
    const { users } = await import("./src/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    await db.delete(users).where(eq(users.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear / Reset all demo data tables
app.post("/api/reset", async (_req, res) => {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Accounting Portal] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
