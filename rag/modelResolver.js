import { OLLAMA_HOST } from "./config.js";

// 채팅 모델은 런타임에 Ollama `/api/ps` 로 자동 해석.
// 운영자가 채팅 모델 1개만 띄운다는 전제 — 임베딩(nomic-embed-text 류) 제외 후 첫 모델 선택.
// 캐시: 프로세스 라이프타임. RAG 서버 재기동 시 재해석.
let cached = null;

const NOT_AVAILABLE_MSG = "AI 모델에 연결할 수 없습니다.";

export async function resolveChatModel() {
  if (cached) return cached;
  let res;
  try {
    res = await fetch(`${OLLAMA_HOST}/api/ps`);
  } catch {
    throw new Error(NOT_AVAILABLE_MSG);
  }
  if (!res.ok) throw new Error(NOT_AVAILABLE_MSG);
  const data = await res.json().catch(() => ({}));
  const models = Array.isArray(data?.models) ? data.models : [];
  // 임베딩 전용 모델은 채팅으로 못 씀 — 이름 prefix 로 제외.
  const chat = models.find((m) => typeof m?.name === "string" && !/^nomic-embed/.test(m.name));
  if (!chat) throw new Error(NOT_AVAILABLE_MSG);
  cached = chat.name;
  return cached;
}

// 테스트/명시적 재해석용
export function resetChatModelCache() {
  cached = null;
}
