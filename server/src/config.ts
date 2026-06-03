import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  textModel: process.env.OPENAI_TEXT_MODEL ?? "gpt-5.4-mini",
  transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe",
  fineTuneBaseModel: process.env.FINE_TUNE_BASE_MODEL ?? "gpt-4.1-mini-2025-04-14"
};
