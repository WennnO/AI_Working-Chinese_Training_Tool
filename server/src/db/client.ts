import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

type DbValue = string | number | null | undefined;

function databasePath() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  const filePath = raw.startsWith("file:") ? raw.slice(5) : raw;
  return path.resolve(filePath);
}

const dbPath = databasePath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS correction_sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      inputText TEXT NOT NULL,
      transcript TEXT,
      tonePreference TEXT NOT NULL DEFAULT 'natural',
      resultJson TEXT NOT NULL,
      savedToLibrary INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expressions (
      id TEXT PRIMARY KEY,
      phrase TEXT NOT NULL,
      context TEXT NOT NULL,
      category TEXT NOT NULL,
      sourceSessionId TEXT,
      usageCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fine_tune_examples (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      inputText TEXT NOT NULL,
      idealOutputJson TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fine_tune_jobs (
      id TEXT PRIMARY KEY,
      openaiJobId TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      trainingFileId TEXT NOT NULL,
      fineTunedModel TEXT,
      rawJson TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initDatabase();

function id() { return randomUUID(); }
function all<T>(sql: string, params: DbValue[] = []) { return db.prepare(sql).all(...params) as T[]; }
function get<T>(sql: string, params: DbValue[] = []) { return db.prepare(sql).get(...params) as T | undefined; }

export type CorrectionSessionRow = {
  id: string; mode: string; inputText: string; transcript?: string; tonePreference: string; resultJson: string; savedToLibrary: number; createdAt: string;
};
export type ExpressionRow = { id: string; phrase: string; context: string; category: string; sourceSessionId?: string; usageCount: number; createdAt: string };
export type FineTuneExampleRow = { id: string; mode: string; inputText: string; idealOutputJson: string; notes?: string; createdAt: string };
export type FineTuneJobRow = { id: string; openaiJobId: string; status: string; model: string; trainingFileId: string; fineTunedModel?: string; rawJson: string; createdAt: string; updatedAt: string };

export function createCorrectionSession(data: { mode: string; inputText: string; transcript?: string; tonePreference: string; resultJson: string }) {
  const rowId = id();
  db.prepare("INSERT INTO correction_sessions (id, mode, inputText, transcript, tonePreference, resultJson) VALUES (?, ?, ?, ?, ?, ?)")
    .run(rowId, data.mode, data.inputText, data.transcript ?? null, data.tonePreference, data.resultJson);
  return get<CorrectionSessionRow>("SELECT * FROM correction_sessions WHERE id = ?", [rowId])!;
}

export function getCorrectionSession(rowId: string) {
  return get<CorrectionSessionRow>("SELECT * FROM correction_sessions WHERE id = ?", [rowId]);
}

export function listCorrectionSessions() {
  return all<CorrectionSessionRow>("SELECT * FROM correction_sessions ORDER BY createdAt DESC LIMIT 30");
}

export function markCorrectionSaved(rowId: string) {
  db.prepare("UPDATE correction_sessions SET savedToLibrary = 1 WHERE id = ?").run(rowId);
}

export function createExpression(data: { phrase: string; context: string; category: string; sourceSessionId?: string }) {
  const rowId = id();
  db.prepare("INSERT INTO expressions (id, phrase, context, category, sourceSessionId) VALUES (?, ?, ?, ?, ?)")
    .run(rowId, data.phrase, data.context, data.category, data.sourceSessionId ?? null);
  return get<ExpressionRow>("SELECT * FROM expressions WHERE id = ?", [rowId])!;
}

export function listExpressions() { return all<ExpressionRow>("SELECT * FROM expressions ORDER BY createdAt DESC"); }
export function incrementExpressionUsage(rowId: string) {
  db.prepare("UPDATE expressions SET usageCount = usageCount + 1 WHERE id = ?").run(rowId);
  return get<ExpressionRow>("SELECT * FROM expressions WHERE id = ?", [rowId]);
}
export function deleteExpression(rowId: string) { db.prepare("DELETE FROM expressions WHERE id = ?").run(rowId); }

export function createFineTuneExample(data: { mode: string; inputText: string; idealOutputJson: string; notes?: string }) {
  const rowId = id();
  db.prepare("INSERT INTO fine_tune_examples (id, mode, inputText, idealOutputJson, notes) VALUES (?, ?, ?, ?, ?)")
    .run(rowId, data.mode, data.inputText, data.idealOutputJson, data.notes ?? null);
  return get<FineTuneExampleRow>("SELECT * FROM fine_tune_examples WHERE id = ?", [rowId])!;
}
export function listFineTuneExamples(order: "asc" | "desc" = "desc") {
  return all<FineTuneExampleRow>(`SELECT * FROM fine_tune_examples ORDER BY createdAt ${order.toUpperCase()}`);
}

export function createFineTuneJob(data: { openaiJobId: string; status: string; model: string; trainingFileId: string; fineTunedModel?: string | null; rawJson: string }) {
  const rowId = id();
  db.prepare("INSERT INTO fine_tune_jobs (id, openaiJobId, status, model, trainingFileId, fineTunedModel, rawJson) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(rowId, data.openaiJobId, data.status, data.model, data.trainingFileId, data.fineTunedModel ?? null, data.rawJson);
  return get<FineTuneJobRow>("SELECT * FROM fine_tune_jobs WHERE id = ?", [rowId])!;
}
export function listFineTuneJobs() { return all<FineTuneJobRow>("SELECT * FROM fine_tune_jobs ORDER BY createdAt DESC"); }
export function getFineTuneJob(rowId: string) { return get<FineTuneJobRow>("SELECT * FROM fine_tune_jobs WHERE id = ?", [rowId]); }
export function updateFineTuneJob(rowId: string, data: { status: string; fineTunedModel?: string | null; rawJson: string }) {
  db.prepare("UPDATE fine_tune_jobs SET status = ?, fineTunedModel = ?, rawJson = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?")
    .run(data.status, data.fineTunedModel ?? null, data.rawJson, rowId);
  return get<FineTuneJobRow>("SELECT * FROM fine_tune_jobs WHERE id = ?", [rowId])!;
}
