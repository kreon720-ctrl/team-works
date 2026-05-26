import { OLLAMA_HOST } from "./config.js";

// 채팅 모델은 매 호출마다 Ollama `/api/ps` 로 자동 해석.
// 운영 룰: 운영자는 chat 모델을 정확히 1개만 메모리에 띄워야 한다.
// - 0개: "AI 모델에 연결할 수 없습니다."
// - 1개: 자동 선택 (운영자가 띄운 그 모델)
// - 2개 이상: "AI 모델을 1개만 띄워주세요" — /api/ps 응답 순서가 보장되지 않아
//   여러 개 중 임의 선택은 비결정적. 운영자가 의도한 모델 1개만 남기도록 강제.
//
// 호출 비용: localhost /api/ps ~5ms. parse-* 류가 1초+ 걸리므로 상대적 비용 무시 가능.

const NOT_AVAILABLE_MSG = "AI 모델에 연결할 수 없습니다.";
const TOO_MANY_MSG = "AI 모델을 1개만 띄워주세요";

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
  const chats = models.filter((m) => typeof m?.name === "string" && !/^nomic-embed/.test(m.name));
  if (chats.length === 0) throw new Error(NOT_AVAILABLE_MSG);
  if (chats.length > 1) {
    const names = chats.map((m) => m.name).join(", ");
    throw new Error(`${TOO_MANY_MSG} (현재 ${chats.length}개 떠 있음: ${names})`);
  }
  return chats[0].name;
}
