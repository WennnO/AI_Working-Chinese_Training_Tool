export type CoachMode = "sentence" | "report";

export type CoachResult = {
  naturalVersion: string;
  formalVersion: string;
  reportVersion: string;
  explanation: Array<{ issue: string; whyItSoundsEnglish: string; chineseHabit: string }>;
  mixedLanguageReplacements: Array<{ original: string; suggestedChinese: string; context: string }>;
  practice: Array<{ prompt: string; targetPattern: string; sampleAnswer: string }>;
  reusableExpressions: Array<{ phrase: string; context: string; category: string }>;
  confidenceNotes: string;
};

export type CorrectionResponse = { sessionId: string; result: CoachResult };

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed: ${response.status}`);
  return data as T;
}

export async function requestCorrection(inputText: string, mode: CoachMode) {
  const response = await fetch("/api/corrections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputText, mode, tonePreference: "both" })
  });
  return parseResponse<CorrectionResponse>(response);
}

export async function transcribeRecording(blob: Blob) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  const response = await fetch("/api/transcribe", { method: "POST", body: form });
  return parseResponse<{ text: string }>(response);
}

export async function saveExpressions(sessionId: string) {
  const response = await fetch(`/api/corrections/${sessionId}/save-expressions`, { method: "POST" });
  return parseResponse<{ saved: number }>(response);
}

export async function getLibrary() {
  const response = await fetch("/api/library");
  return parseResponse<Array<{ id: string; phrase: string; context: string; category: string; usageCount: number }>>(response);
}

export async function addLibraryExpression(payload: { phrase: string; context: string; category: string }) {
  const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return parseResponse(response);
}

export async function saveFineTuneExample(payload: { mode: CoachMode; inputText: string; idealOutputJson: string; notes?: string }) {
  const response = await fetch("/api/fine-tune/examples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return parseResponse(response);
}

export async function getFineTuneExamples() {
  const response = await fetch("/api/fine-tune/examples");
  return parseResponse<Array<{ id: string; mode: CoachMode; inputText: string; createdAt: string }>>(response);
}

export async function startFineTune(baseModel?: string) {
  const response = await fetch("/api/fine-tune/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseModel }) });
  return parseResponse(response);
}

export async function getFineTuneJobs() {
  const response = await fetch("/api/fine-tune/jobs");
  return parseResponse<Array<{ id: string; openaiJobId: string; status: string; model: string; fineTunedModel?: string }>>(response);
}
