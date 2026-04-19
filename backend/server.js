import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import http from "http";
import https from "https";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

process.on("uncaughtException", (err) => {
  console.error("CRITICAL: Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL: Unhandled Rejection at:", promise, "reason:", reason);
});

const app = express();
const PORT = process.env.PORT || 4000;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3-32b";

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── DEPLOYMENT CHECK ──
if (!process.env.GROQ_API_KEY && process.env.NODE_ENV === "production") {
  console.warn("WARNING: GROQ_API_KEY is not set. AI features will fail.");
}

// ── INVISIBLE HINDSIGHT VAULT ──
const VAULT_PATH = path.join(__dirname, "hindsight_vault.json");

function loadVault() {
  try {
    if (fs.existsSync(VAULT_PATH)) {
      return JSON.parse(fs.readFileSync(VAULT_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Vault read error:", err);
  }
  return {};
}

function saveToVault(fileName, data) {
  try {
    const vault = loadVault();
    vault[fileName] = {
      score: data.score || 0,
      issues: data.issues || [],
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2));
  } catch (err) {
    console.error("Vault write error:", err);
  }
}

// ── API ROUTES ──
const router = express.Router();

app.use("/api", router);

// Serve static files from the frontend/dist folder
const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));

async function getModernizedCode(code, language, targetVersion, previousContext = null) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Missing GROQ_API_KEY in environment variables.");
  }

  // Define formatting instructions separately to avoid character escaping issues in the prompt
  const formatInstructions = `
{
  "issues": [
    {
      "lineStart": number,
      "lineEnd": number,
      "reason": "short explanation",
      "detailedReason": "full technical explanation of why this change is needed",
      "benefits": ["performance improve", "better readability", "modern syntax"],
      "useCase": "practical example or context of use",
      "riskLevel": "Low" | "Medium" | "High",
      "suggestedFix": "corrected code snippet"
    }
  ],
  "refactoredCode": "the entire file contents with all fixes applied"
}
`.trim();

  const systemPrompt = `You are an expert ${language} modernization engineer. Analyze the code and identify patterns outdated compared to ${language} ${targetVersion} standards.
You MUST respond with a JSON object following this structure:
${formatInstructions}
Respond ONLY with the JSON object. Do not provide explanations or markdown.`;
  
  const hindsightContext = previousContext 
    ? `HINDSIGHT CONTEXT: This file was previously analyzed. 
       - Previous Modernization Health: ${previousContext.score}%
       - Previous Issues Found: ${JSON.stringify(previousContext.issues)}
       Please verify if these issues are resolved and use this hindsight to find even deeper optimizations.`
    : "";

  const userPrompt = `Modernize this ${language} code to ${targetVersion} standards. Return ONLY the JSON object.

${hindsightContext}

${code}`;

  let response;
  try {
    response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2
      },
      {
        timeout: 60000,
        httpAgent,
        httpsAgent,
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (apiError) {
    console.error("GROQ API ERROR:", apiError.response?.data || apiError.message);
    const groqMessage =
      apiError.response?.data?.error?.message ||
      apiError.message ||
      "Groq request failed";
    throw new Error(`Groq API failed: ${groqMessage}`);
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq API returned an empty response.");
  }

  try {
    // Stage 1: Basic cleaning
    let cleaned = content.trim();
    
    // Stage 2: Strip markdown code fences if they exist
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    
    // Stage 3: Find the first { and last } to isolate the JSON if there's surrounding text
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);

    // Stage 4: Validate and normalize
    if (!parsed || typeof parsed !== "object") throw new Error("Parsed content is not an object");
    if (!Array.isArray(parsed.issues)) parsed.issues = [];
    if (typeof parsed.refactoredCode !== "string") {
      parsed.refactoredCode = parsed.modernizedCode || parsed.updatedCode || code;
    }

    // Ensure line numbers are numbers
    parsed.issues = parsed.issues.map(issue => ({
      ...issue,
      lineStart: Number(issue.lineStart) || 1,
      lineEnd: Number(issue.lineEnd) || Number(issue.lineStart) || 1
    }));

    return parsed;
  } catch (parseError) {
    console.error("GROQ JSON PARSE ERROR:", parseError.message);
    console.error("RAW CONTENT PREVIEW:", content.slice(0, 500));
    
    // Resilience: try to return something useful even on failure
    return { 
      issues: [], 
      refactoredCode: code,
      error: "The AI response was malformed. You can still use the original code."
    };
  }
}

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.post("/analyze", async (req, res) => {
  try {
    const { code, language = "java", targetVersion = "21", fileName = "Unknown" } = req.body;
    console.log(`Analyzing [${fileName}] for ${language}...`);

    if (!code || typeof code !== "string") {
      return res.status(400).json({
        error: "Request body must include a non-empty string field: code"
      });
    }

    // ── Internal Hindsight Recovery ──
    const vault = loadVault();
    const previousContext = vault[fileName] || null;
    if (previousContext) {
      console.log(`Hindsight utilized for [${fileName}]. Previous Health: ${previousContext.score}%`);
    }

    const solution = await getModernizedCode(code, language, targetVersion, previousContext);

    // ── Save Result to Inner Vault ──
    const lineCount = code.split("\n").length;
    const issueLines = solution.issues.reduce((acc, i) => acc + (i.lineEnd - i.lineStart + 1), 0);
    const score = Math.max(0, Math.round(100 - (issueLines / lineCount) * 100));
    
    saveToVault(fileName, { score, issues: solution.issues });

    return res.json({
      success: true,
      data: solution
    });
  } catch (err) {
    console.error("ANALYZE ENDPOINT ERROR:", err);
    const details =
      err.response?.data?.error?.message || err.message || "Unknown server error";
    return res.status(500).json({ error: "Failed to analyze code", details });
  }
});

router.post("/chat", async (req, res) => {
  try {
    const { message, codeSnippet, issueDetail } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = `You are an expert AI coding assistant specializing in Java modernization. 
    You are helping a developer understand a specific code modernization issue.
    
    CONTEXT ABOUT THE ISSUE:
    ${JSON.stringify(issueDetail, null, 2)}
    
    THE CODE SNIPPET:
    ${codeSnippet}
    
    Respond in a professional, helpful, and concise manner. Use markdown for code formatting.`;

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [{ role: "user", content: systemPrompt + "\n\nUSER QUESTION: " + message }],
        temperature: 0.5
      },
      {
        timeout: 30000,
        httpAgent,
        httpsAgent,
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    return res.json({ success: true, reply });
  } catch (err) {
    console.error("CHAT ENDPOINT ERROR:", err);
    return res.status(500).json({ error: "Failed to process chat message" });
  }
});

// ── CATCH-ALL ROUTE FOR SPA ──
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`🔗 Access at http://0.0.0.0:${PORT}`);
});
