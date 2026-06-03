import { Router } from "express";
import { z } from "zod";
import { createCorrectionSession, createExpression, getCorrectionSession, listCorrectionSessions, markCorrectionSaved } from "../db/client.js";
import { correctWithAI } from "../services/openai.js";

const router = Router();
const correctionInput = z.object({
  inputText: z.string().min(1),
  mode: z.enum(["sentence", "report"]),
  tonePreference: z.enum(["natural", "formal", "both"]).default("both"),
  transcript: z.string().optional()
});

router.post("/", async (req, res, next) => {
  try {
    const payload = correctionInput.parse(req.body);
    const result = await correctWithAI(payload);
    const session = createCorrectionSession({
      mode: payload.mode,
      inputText: payload.inputText,
      transcript: payload.transcript,
      tonePreference: payload.tonePreference,
      resultJson: JSON.stringify(result)
    });
    res.json({ sessionId: session.id, result });
  } catch (error) { next(error); }
});

router.get("/history", (_req, res, next) => {
  try {
    const rows = listCorrectionSessions();
    res.json(rows.map((row) => ({ ...row, savedToLibrary: Boolean(row.savedToLibrary), result: JSON.parse(row.resultJson) })));
  } catch (error) { next(error); }
});

router.post("/:id/save-expressions", (req, res, next) => {
  try {
    const session = getCorrectionSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Correction session not found." });
      return;
    }
    const result = JSON.parse(session.resultJson) as { reusableExpressions?: Array<{ phrase: string; context: string; category: string }> };
    const expressions = result.reusableExpressions ?? [];
    expressions.forEach((expression) => createExpression({ ...expression, sourceSessionId: session.id }));
    markCorrectionSaved(session.id);
    res.json({ saved: expressions.length });
  } catch (error) { next(error); }
});

export default router;
