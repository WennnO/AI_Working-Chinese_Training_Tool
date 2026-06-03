import { Router } from "express";
import { z } from "zod";
import { createExpression, deleteExpression, incrementExpressionUsage, listExpressions } from "../db/client.js";

const router = Router();
const expressionInput = z.object({ phrase: z.string().min(1), context: z.string().min(1), category: z.string().min(1).default("general") });

router.get("/", (_req, res, next) => {
  try { res.json(listExpressions()); }
  catch (error) { next(error); }
});

router.post("/", (req, res, next) => {
  try { res.status(201).json(createExpression(expressionInput.parse(req.body))); }
  catch (error) { next(error); }
});

router.patch("/:id/use", (req, res, next) => {
  try {
    const expression = incrementExpressionUsage(req.params.id);
    if (!expression) res.status(404).json({ error: "Expression not found." });
    else res.json(expression);
  } catch (error) { next(error); }
});

router.delete("/:id", (req, res, next) => {
  try { deleteExpression(req.params.id); res.status(204).end(); }
  catch (error) { next(error); }
});

export default router;
