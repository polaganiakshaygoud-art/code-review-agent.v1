import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import incidentRouter from "./routes/incident.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "incident-response-ai-agent-backend" });
});

app.use("/api/incidents", incidentRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
