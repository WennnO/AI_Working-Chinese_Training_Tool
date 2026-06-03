import fs from "node:fs/promises";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { createFineTuneExample, createFineTuneJob, getFineTuneJob, listFineTuneExamples, listFineTuneJobs, updateFineTuneJob } from "../db/client.js";
import { generatedTrainingPath, retrieveFineTuneJob, startFineTuneJob, toFineTuneJsonlLine } from "../services/openai.js";

const router = Router();
const exampleInput = z.object({ mode: z.enum(["sentence", "report"]), inputText: z.string().min(1), idealOutputJson: z.string().min(1), notes: z.string().optional() });

router.get("/examples", (_req, res, next) => {
  try { res.json(listFineTuneExamples("desc")); }
  catch (error) { next(error); }
});

router.post("/examples", (req, res, next) => {
  try {
    const payload = exampleInput.parse(req.body);
    JSON.parse(payload.idealOutputJson);
    res.status(201).json(createFineTuneExample(payload));
  } catch (error) { next(error); }
});

router.get("/dataset.jsonl", (_req, res, next) => {
  try {
    const examples = listFineTuneExamples("asc");
    res.type("text/plain").send(examples.map(toFineTuneJsonlLine).join("\n") + (examples.length ? "\n" : ""));
  } catch (error) { next(error); }
});

router.post("/jobs", async (req, res, next) => {
  try {
    const body = z.object({ baseModel: z.string().optional() }).parse(req.body);
    const examples = listFineTuneExamples("asc");
    if (examples.length < 10) {
      res.status(400).json({ error: "At least 10 high-quality examples are recommended before starting a fine-tuning job." });
      return;
    }
    const jsonlPath = generatedTrainingPath(`working-chinese-${Date.now()}.jsonl`);
    await fs.writeFile(jsonlPath, examples.map(toFineTuneJsonlLine).join("\n") + "\n", "utf8");
    const { file, job } = await startFineTuneJob(jsonlPath, body.baseModel ?? config.fineTuneBaseModel);
    res.status(201).json(createFineTuneJob({
      openaiJobId: job.id,
      status: job.status,
      model: String(job.model),
      trainingFileId: file.id,
      fineTunedModel: job.fine_tuned_model,
      rawJson: JSON.stringify(job)
    }));
  } catch (error) { next(error); }
});

router.get("/jobs", (_req, res, next) => {
  try { res.json(listFineTuneJobs()); }
  catch (error) { next(error); }
});

router.post("/jobs/:id/refresh", async (req, res, next) => {
  try {
    const existing = getFineTuneJob(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Fine-tune job not found." });
      return;
    }
    const fresh = await retrieveFineTuneJob(existing.openaiJobId);
    res.json(updateFineTuneJob(existing.id, { status: fresh.status, fineTunedModel: fresh.fine_tuned_model, rawJson: JSON.stringify(fresh) }));
  } catch (error) { next(error); }
});

export default router;
