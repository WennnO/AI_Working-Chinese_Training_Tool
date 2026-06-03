import express from "express";
import cors from "cors";
import correctionsRouter from "./routes/corrections.js";
import transcriptionRouter from "./routes/transcription.js";
import libraryRouter from "./routes/library.js";
import fineTuneRouter from "./routes/fineTune.js";
import { config } from "./config.js";

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "working-chinese-coach", time: new Date().toISOString() });
});

app.use("/api/corrections", correctionsRouter);
app.use("/api/transcribe", transcriptionRouter);
app.use("/api/library", libraryRouter);
app.use("/api/fine-tune", fineTuneRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(error);
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Working Chinese coach server running on http://localhost:${config.port}`);
});
