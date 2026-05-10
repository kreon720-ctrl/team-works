// Open WebUI 호출 시 사용할 chat 모델 이름을 매 호출 시 자동 해석.
// 운영 룰: 운영자는 Open WebUI 가 인식하는 chat 모델을 정확히 1개만 노출해야 한다.
// - 0개: "AI 모델에 연결할 수 없습니다."
// - 1개: 자동 선택 (운영자가 노출한 그 모델)
// - 2개 이상: "AI 모델을 1개만 띄워주세요" — /api/models 응답 순서가 보장되지
//   않아 여러 개 중 임의 선택은 비결정적. 운영자가 Ollama 에서 ollama rm 또는
//   Open WebUI Admin → Models 에서 Off 토글로 1개만 남기도록 강제.
//
// 강제 지정 escape hatch: `.env` 의 OPEN_WEBUI_MODEL 명시 시 검증 우회 + 그 값 사용.
//
// 제외 대상: 임베딩 모델(`nomic-embed-*`), Open WebUI 시스템 모델
// (`arena-model` — 모델 비교용 가상 모델).
//
// 호출 비용: localhost /api/models ~수십 ms. chat 응답 자체가 수 초~수십 초이므로 무시 가능.

const OPEN_WEBUI_BASE_URL =
  process.env.OPEN_WEBUI_BASE_URL || 'http://127.0.0.1:8081';
const OPEN_WEBUI_API_KEY = process.env.OPEN_WEBUI_API_KEY || '';
const NOT_AVAILABLE_MSG = 'AI 모델에 연결할 수 없습니다.';
const TOO_MANY_MSG = 'AI 모델을 1개만 띄워주세요';

interface OpenWebUiModel {
  id?: string;
  name?: string;
}

const EXCLUDE_RE = /^(arena-model|nomic-embed)/i;

export async function resolveOpenWebUiModel(): Promise<string> {
  const explicit = process.env.OPEN_WEBUI_MODEL?.trim();
  if (explicit) return explicit;
  if (!OPEN_WEBUI_API_KEY) throw new Error(NOT_AVAILABLE_MSG);

  let res: Response;
  try {
    res = await fetch(`${OPEN_WEBUI_BASE_URL}/api/models`, {
      headers: { authorization: `Bearer ${OPEN_WEBUI_API_KEY}` },
    });
  } catch {
    throw new Error(NOT_AVAILABLE_MSG);
  }
  if (!res.ok) throw new Error(NOT_AVAILABLE_MSG);

  const payload = (await res.json().catch(() => ({}))) as
    | { data?: OpenWebUiModel[] }
    | OpenWebUiModel[];
  const models: OpenWebUiModel[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  const chats = models.filter((m) => {
    const id = (m?.id ?? m?.name ?? '').toString();
    return id !== '' && !EXCLUDE_RE.test(id);
  });
  if (chats.length === 0) throw new Error(NOT_AVAILABLE_MSG);
  if (chats.length > 1) {
    const names = chats
      .map((m) => (m.id ?? m.name ?? '').toString())
      .join(', ');
    throw new Error(`${TOO_MANY_MSG} (현재 ${chats.length}개 등록: ${names})`);
  }
  const id = (chats[0]?.id ?? chats[0]?.name ?? '').toString();
  if (!id) throw new Error(NOT_AVAILABLE_MSG);
  return id;
}
