import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const OLLAMA_DIR = path.join(ROOT, "ollama");
export const MODELFILE_PATH = path.join(OLLAMA_DIR, "Modelfile");
export const CHUNKS_PATH = path.join(__dirname, "data", "chunks.json");

// OLLAMA_HOST 는 Ollama '데몬' 바인딩용(원격 접속 위해 0.0.0.0 등)으로도 쓰여,
// 클라이언트 접속 URL 로는 부적합할 수 있다. 스킴 보정 + 0.0.0.0(전체 바인딩) → 127.0.0.1(루프백)
// 로 정규화해, 같은 머신의 Ollama 에 안전하게 접속한다.
function resolveOllamaUrl(raw) {
  const fallback = "http://127.0.0.1:11434";
  const s = (raw || "").trim();
  if (!s) return fallback;
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `http://${s}`);
    if (u.hostname === "0.0.0.0") u.hostname = "127.0.0.1";
    if (!u.port) u.port = "11434";
    return u.origin;
  } catch {
    return fallback;
  }
}

export const OLLAMA_HOST = resolveOllamaUrl(process.env.OLLAMA_HOST);
// 임베딩 모델은 인덱스(chunks.json)와 차원이 일치해야 해서 env 기반 고정.
// 채팅 모델은 modelResolver.resolveChatModel() 가 런타임에 /api/ps 로 자동 해석.
export const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
// 32K 컨텍스트 안에서 parent-document 전문 첨부가 가능한 안전 범위.
export const TOP_K = Number(process.env.TOP_K || 5);
export const SERVER_PORT = Number(process.env.PORT || 8787);
