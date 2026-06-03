import { useEffect, useMemo, useState } from "react";
import { BookOpen, Database, FileAudio, Library, Loader2, MessageSquareText, Save, Sparkles, UploadCloud } from "lucide-react";
import { Recorder } from "./components/Recorder";
import { addLibraryExpression, CoachMode, CoachResult, getFineTuneExamples, getFineTuneJobs, getLibrary, requestCorrection, saveExpressions, saveFineTuneExample, startFineTune } from "./lib/api";
import "./styles.css";

type Tab = "coach" | "report" | "library" | "finetune";

const examples = {
  sentence: "我需要去 make sure 这个事情 is aligned with everyone，然后我们可以 move forward。",
  report: "这个project现在基本done了，但是testing还有一些blocker。我们need to align一下priority，然后下周看看能不能push上线。"
};

function ResultPanel({ result, sessionId, originalInput, mode }: { result: CoachResult; sessionId: string; originalInput: string; mode: CoachMode }) {
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState("");

  async function saveAll() {
    setSaving(true);
    setSavedText("");
    try {
      await saveExpressions(sessionId);
      await saveFineTuneExample({ mode, inputText: originalInput, idealOutputJson: JSON.stringify(result), notes: "Saved from correction result" });
      setSavedText("已保存到表达库和训练样本");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="resultGrid">
      <div className="panel mainResult">
        <div className="panelHeader"><Sparkles size={18} /><h2>{mode === "report" ? "汇报口语版" : "自然口语版"}</h2></div>
        <p className="outputText">{mode === "report" ? result.reportVersion : result.naturalVersion}</p>
      </div>
      <div className="panel">
        <div className="panelHeader"><MessageSquareText size={18} /><h2>稍正式版</h2></div>
        <p className="outputText">{result.formalVersion}</p>
      </div>
      <div className="panel wide">
        <div className="panelHeader"><BookOpen size={18} /><h2>为什么这样改</h2></div>
        <div className="stack">
          {result.explanation.map((item, index) => (
            <div className="explainRow" key={`${item.issue}-${index}`}>
              <strong>{item.issue}</strong>
              <span>{item.whyItSoundsEnglish}</span>
              <span>{item.chineseHabit}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panelHeader"><FileAudio size={18} /><h2>中英混杂替换</h2></div>
        <div className="chipList">
          {result.mixedLanguageReplacements.map((item) => <span className="chip" key={item.original}>{item.original} -&gt; {item.suggestedChinese}</span>)}
        </div>
      </div>
      <div className="panel">
        <div className="panelHeader"><Library size={18} /><h2>两个小练习</h2></div>
        <div className="stack">
          {result.practice.map((item, index) => (
            <div className="practice" key={item.prompt}>
              <strong>练习 {index + 1}: {item.prompt}</strong>
              <span>句型：{item.targetPattern}</span>
              <span>参考：{item.sampleAnswer}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel wide">
        <div className="panelHeader"><Save size={18} /><h2>可积累表达</h2></div>
        <div className="expressionGrid">
          {result.reusableExpressions.map((item) => (
            <div className="expression" key={`${item.phrase}-${item.context}`}>
              <strong>{item.phrase}</strong>
              <span>{item.context}</span>
              <small>{item.category}</small>
            </div>
          ))}
        </div>
        <button className="primaryButton" onClick={saveAll} disabled={saving} title="保存表达和微调样本">
          {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />} 保存到表达库和训练样本
        </button>
        {savedText && <p className="note">{savedText}</p>}
      </div>
      {result.confidenceNotes && <p className="note wide">{result.confidenceNotes}</p>}
    </section>
  );
}

function CoachWorkspace({ mode }: { mode: CoachMode }) {
  const [input, setInput] = useState(examples[mode]);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const response = await requestCorrection(input, mode);
      setResult(response.result);
      setSessionId(response.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <section className="inputPanel">
        <div className="modeLabel">{mode === "report" ? "汇报整理" : "句子纠正"}</div>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入中文、英文或中英混杂的工作表达" />
        <div className="toolbar">
          <Recorder onTranscript={(text) => setInput((current) => current ? `${current}\n${text}` : text)} onError={setError} />
          <button className="primaryButton" onClick={submit} disabled={busy || !input.trim()} title="调用 AI 纠正">
            {busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />} {busy ? "处理中" : "生成中文表达"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
      {result && <ResultPanel result={result} sessionId={sessionId} originalInput={input} mode={mode} />}
    </main>
  );
}

function LibraryView() {
  const [items, setItems] = useState<Array<{ id: string; phrase: string; context: string; category: string; usageCount: number }>>([]);
  const [form, setForm] = useState({ phrase: "", context: "", category: "会议" });

  async function load() { setItems(await getLibrary()); }
  useEffect(() => { void load(); }, []);

  async function add() {
    await addLibraryExpression(form);
    setForm({ phrase: "", context: "", category: "会议" });
    await load();
  }

  return (
    <main className="workspace">
      <section className="inputPanel compact">
        <div className="modeLabel">我的表达库</div>
        <div className="inlineForm">
          <input value={form.phrase} onChange={(e) => setForm({ ...form, phrase: e.target.value })} placeholder="表达，例如：我先同步一下进展" />
          <input value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="使用场景" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="类别" />
          <button className="primaryButton" onClick={add} disabled={!form.phrase || !form.context} title="添加表达"><Save size={18} /> 添加</button>
        </div>
      </section>
      <section className="libraryGrid">
        {items.map((item) => (
          <div className="expression" key={item.id}>
            <strong>{item.phrase}</strong>
            <span>{item.context}</span>
            <small>{item.category} · 用过 {item.usageCount} 次</small>
          </div>
        ))}
      </section>
    </main>
  );
}
function FineTuneView() {
  const [examplesCount, setExamplesCount] = useState(0);
  const [jobs, setJobs] = useState<Array<{ id: string; openaiJobId: string; status: string; model: string; fineTunedModel?: string }>>([]);
  const [baseModel, setBaseModel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [examplesList, loadedJobs] = await Promise.all([getFineTuneExamples(), getFineTuneJobs()]);
    setExamplesCount(examplesList.length);
    setJobs(loadedJobs);
  }
  useEffect(() => { void load(); }, []);

  async function start() {
    setError("");
    setBusy(true);
    try {
      await startFineTune(baseModel || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建微调任务失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace">
      <section className="inputPanel compact">
        <div className="modeLabel">微调训练</div>
        <div className="metrics">
          <div><strong>{examplesCount}</strong><span>训练样本</span></div>
          <div><strong>{jobs.length}</strong><span>微调任务</span></div>
        </div>
        <div className="inlineForm">
          <input value={baseModel} onChange={(e) => setBaseModel(e.target.value)} placeholder="base model，可留空用 .env" />
          <a className="secondaryButton" href="/api/fine-tune/dataset.jsonl" target="_blank" rel="noreferrer"><Database size={18} /> 查看 JSONL</a>
          <button className="primaryButton" onClick={start} disabled={busy} title="上传训练文件并创建 OpenAI fine-tuning job">
            {busy ? <Loader2 className="spin" size={18} /> : <UploadCloud size={18} />} 开始微调
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="libraryGrid">
        {jobs.map((job) => (
          <div className="expression" key={job.id}>
            <strong>{job.status}</strong>
            <span>{job.openaiJobId}</span>
            <small>{job.fineTunedModel || job.model}</small>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("coach");
  const current = useMemo(() => {
    if (tab === "report") return <CoachWorkspace mode="report" />;
    if (tab === "library") return <LibraryView />;
    if (tab === "finetune") return <FineTuneView />;
    return <CoachWorkspace mode="sentence" />;
  }, [tab]);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><span>中</span><strong>Working Chinese Coach</strong></div>
        <nav>
          <button className={tab === "coach" ? "active" : ""} onClick={() => setTab("coach")}><MessageSquareText size={18} /> 句子纠正</button>
          <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}><BookOpen size={18} /> 汇报整理</button>
          <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><Library size={18} /> 表达库</button>
          <button className={tab === "finetune" ? "active" : ""} onClick={() => setTab("finetune")}><Database size={18} /> 微调</button>
        </nav>
      </aside>
      {current}
    </div>
  );
}
