import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { Router } from "express";
import { transcribeAudio } from "../services/openai.js";

const router = Router();
const uploadDir = path.resolve("uploads");

const extensionByMimeType: Record<string, string> = {
  "audio/webm": ".webm",
  "video/webm": ".webm",
  "audio/mp4": ".mp4",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mpga": ".mpga",
  "audio/m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/flac": ".flac"
};

function cleanMimeType(mimeType = "") {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionForUpload(file: Express.Multer.File) {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();
  if (originalExtension) return originalExtension;
  return extensionByMimeType[cleanMimeType(file.mimetype)] ?? ".webm";
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fsSync.mkdirSync(uploadDir, { recursive: true });
      callback(null, uploadDir);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extensionForUpload(file)}`);
    }
  })
});

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
