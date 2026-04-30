import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const OLLAMA_DIR = path.join(ROOT, "ollama");
export const MODELFILE_PATH = path.join(OLLAMA_DIR, "Modelfile");
export const CHUNKS_PATH = path.join(__dirname, "data", "chunks.json");

export const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
// 임베딩 모델은 인덱스(chunks.json)와 차원이 일치해야 해서 env 기반 고정.
// 채팅 모델은 modelResolver.resolveChatModel() 가 런타임에 /api/ps 로 자동 해석.
export const EMBED_MODEL = process.env.EMBED_MODEL || "nomic-embed-text";
// 32K 컨텍스트 안에서 parent-document 전문 첨부가 가능한 안전 범위.
export const TOP_K = Number(process.env.TOP_K || 5);
export const SERVER_PORT = Number(process.env.PORT || 8787);
