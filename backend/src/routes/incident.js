import { Router } from "express";
import { generateSolutionFromGroq } from "../services/groqService.js";
import {
  findSimilarIncident,
  getMemoryStats,
  saveIncident
} from "../services/memoryService.js";

const router = Router();

router.get("/memory/stats", (_req, res) => {
  res.json(getMemoryStats());
});

router.post("/analyze", async (req, res) => {
  try {
    const { errorLog } = req.body;

    if (!errorLog) {
      return res.status(400).json({ error: "errorLog is required" });
    }

    const previousIncident = findSimilarIncident(errorLog);

    if (previousIncident) {
      return res.json({
        source: "memory",
        solution: previousIncident.solution,
        memoryId: previousIncident.id
      });
    }

    const solution = await generateSolutionFromGroq(errorLog);
    const saved = saveIncident(errorLog, solution, "groq");

    return res.json({
      source: "groq",
      solution,
      memoryId: saved?.id || null
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to analyze incident",
      details: error.message
    });
  }
});

export default router;
