import fs from "node:fs/promises";
import multer from "multer";
import { Router } from "express";
import { transcribeAudio } from "../services/openai.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing audio file." });
      return;
    }
    const text = await transcribeAudio(req.file.path);
    await fs.unlink(req.file.path).catch(() => undefined);
    res.json({ text });
  } catch (error) {
    if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
    next(error);
  }
});

export default router;
