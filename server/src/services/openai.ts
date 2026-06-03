import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { config } from "../config.js";

export type CoachMode = "sentence" | "report";
export type CorrectionRequest = {
  inputText: string;
  mode: CoachMode;
  tonePreference?: "natural" | "formal" | "both";
};

const correctionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    naturalVersion: { type: "string" },
    formalVersion: { type: "string" },
    reportVersion: { type: "string" },
    explanation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          issue: { type: "string" },
          whyItSoundsEnglish: { type: "string" },
          chineseHabit: { type: "string" }
        },
        required: ["issue", "whyItSoundsEnglish", "chineseHabit"]
      }
    },
    mixedLanguageReplacements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          suggestedChinese: { type: "string" },
          context: { type: "string" }
        },
        required: ["original", "suggestedChinese", "context"]
      }
    },
    practice: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          targetPattern: { type: "string" },
          sampleAnswer: { type: "string" }
        },
        required: ["prompt", "targetPattern", "sampleAnswer"]
      }
    },
    reusableExpressions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phrase: { type: "string" },
          context: { type: "string" },
          category: { type: "string" }
        },
        required: ["phrase", "context", "category"]
      }
    },
    confidenceNotes: { type: "string" }
  },
  required: ["naturalVersion", "formalVersion", "reportVersion", "explanation", "mixedLanguageReplacements", "practice", "reusableExpressions", "confidenceNotes"]
};

function getOpenAI() {
  if (!config.openaiApiKey || config.openaiApiKey.includes("replace_with")) {
    throw new Error("OPENAI_API_KEY is missing. Replace the placeholder in .env with your real OpenAI API key.");
  }
  return new OpenAI({ apiKey: config.openaiApiKey });
}

function systemPrompt(mode: CoachMode) {
  const shared = "你是一个中文工作表达教练，专门帮助母语为普通话、但长期在英文工作环境中思考的人，把英文语序中文和中英夹杂表达改成自然、清楚、可开口说的中文。中文解释为主，必要时用英文点出英文思维来源。语气温和、具体、不过度书面化。不要只翻译，要训练说话习惯。";
  if (mode === "report") {
    return `${shared}\n当前任务是汇报整理：把用户输入的一长段工作内容整理成完整、顺口、适合会议口头汇报的中文。保留关键信息，重排逻辑，补足自然衔接词，并提炼可积累表达。`;
  }
  return `${shared}\n当前任务是单句纠正：给出自然口语版、稍正式版、英文语序问题解释、英文/中英混杂词替换，并给 2 个小练习。`;
}

function collectOutputText(response: unknown): string {
  const maybe = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (maybe.output_text) return maybe.output_text;
  return maybe.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("\n") ?? "";
}

export async function correctWithAI(payload: CorrectionRequest) {
  const openai = getOpenAI();
  const response = await openai.responses.create({
    model: config.textModel,
    input: [
      { role: "developer", content: systemPrompt(payload.mode) },
      { role: "user", content: JSON.stringify({ mode: payload.mode, tonePreference: payload.tonePreference ?? "both", inputText: payload.inputText }) }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "working_chinese_coach_result",
        strict: true,
        schema: correctionSchema
      }
    }
  });
  const raw = collectOutputText(response);
  if (!raw) throw new Error("OpenAI returned an empty response.");
  return JSON.parse(raw);
}

export async function transcribeAudio(filePath: string) {
  const openai = getOpenAI();
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: config.transcribeModel,
    language: "zh"
  });
  return transcription.text;
}

export async function startFineTuneJob(jsonlPath: string, baseModel = config.fineTuneBaseModel) {
  const openai = getOpenAI();
  const file = await openai.files.create({ file: fs.createReadStream(jsonlPath), purpose: "fine-tune" });
  const job = await openai.fineTuning.jobs.create({ training_file: file.id, model: baseModel, suffix: "working-chinese-coach" });
  return { file, job };
}

export async function retrieveFineTuneJob(openaiJobId: string) {
  const openai = getOpenAI();
  return openai.fineTuning.jobs.retrieve(openaiJobId);
}

export function toFineTuneJsonlLine(example: { mode: string; inputText: string; idealOutputJson: string }) {
  return JSON.stringify({
    messages: [
      { role: "developer", content: systemPrompt(example.mode === "report" ? "report" : "sentence") },
      { role: "user", content: example.inputText },
      { role: "assistant", content: example.idealOutputJson }
    ]
  });
}

export function generatedTrainingPath(filename: string) {
  const dir = path.resolve("generated-training");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}
