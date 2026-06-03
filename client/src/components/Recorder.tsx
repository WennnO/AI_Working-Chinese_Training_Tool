import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { transcribeRecording } from "../lib/api";

type RecorderProps = { onTranscript: (text: string) => void; onError: (message: string) => void };

const recordingFormats = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", extension: "mp4" },
  { mimeType: "audio/mpeg", extension: "mp3" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/wav", extension: "wav" }
];

function getSupportedRecordingFormat() {
  return recordingFormats.find((format) => MediaRecorder.isTypeSupported(format.mimeType));
}

export function Recorder({ onTranscript, onError }: RecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const extensionRef = useRef("webm");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    try {
      const format = getSupportedRecordingFormat();
      if (!format) {
        onError("当前浏览器不支持可转写的录音格式。请换 Chrome、Edge 或 Safari 再试。");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
      extensionRef.current = format.extension;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: format.mimeType });
          const result = await transcribeRecording(blob, extensionRef.current);
          onTranscript(result.text);
        } catch (error) {
          onError(error instanceof Error ? error.message : "录音转文字失败");
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          setBusy(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : "无法打开麦克风");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <button className={`iconButton ${recording ? "danger" : ""}`} onClick={recording ? stop : start} disabled={busy} title={recording ? "停止录音" : "录音转文字"}>
      {recording ? <Square size={18} /> : <Mic size={18} />}
      <span>{busy ? "转写中" : recording ? "停止" : "录音"}</span>
    </button>
  );
}
