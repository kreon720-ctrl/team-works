import { OLLAMA_HOST } from "./config.js";

// 채팅 모델은 매 호출마다 Ollama `/api/ps` 로 자동 해석 — 운영자가 모델 교체해도
// RAG 서버 재기동 없이 즉시 반영. 운영자가 채팅 모델 1개만 띄운다는 전제로
// 임베딩(nomic-embed-text 류) 제외 후 첫 모델 선택.
//
// 호출 비용: localhost /api/ps ~5ms. parse-* 류가 1초+ 걸리므로 상대적 비용 무시 가능.
// 이전엔 프로세스 lifetime 캐시였으나, 운영자가 모델 swap 시 옛 모델 이름이 박혀
// 새 모델이 자동 픽업 안 되는 문제가 있어 매 호출 재해석으로 변경.

const NOT_AVAILABLE_MSG = "AI 모델에 연결할 수 없습니다.";

export async function resolveChatModel() {
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
  return chat.name;
}
