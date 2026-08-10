import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

    let systemInstruction = "You are an expert CPA (Certified Public Accountant) and Tax Advisor assistant for an internal accounting firm team collaboration platform called Bookskonnect. Provide concise, accurate, professional, and practical advice tailored for bookkeepers, auditors, and tax specialists.";

    let userPrompt = "";

    if (action === "draft_update") {
      userPrompt = `Draft a concise, professional accounting update post for the team feed based on these details:
Client: ${context?.clientName || "Client"}
Title/Topic: ${context?.title || "Filing Update"}
Category: ${context?.category || "General Bookkeeping"}
Notes: ${prompt || "Routine progress update"}

Provide a clean, bulleted or short paragraph draft suitable for posting on Bookskonnect.`;
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
Contact Email: ${context?.contactEmail || "finance@client.com"}
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
  res.json({ status: "ok", app: "Bookskonnect" });
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
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Bookskonnect] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
