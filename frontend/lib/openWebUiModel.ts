// Open WebUI 호출 시 사용할 chat 모델 이름을 매 호출 시 자동 해석.
// 기준: Ollama /api/ps (메모리 로드된 모델). 운영자가 ollama run 으로 1개만 띄우면
// 그 모델이 자동 선택. 디스크에 여러 모델 설치돼 있어도 무방.
//
// 운영 룰: 메모리 로드된 chat 모델은 정확히 1개여야 함.
// - 0개: "AI 모델에 연결할 수 없습니다." (모델을 ollama run 으로 띄워야)
// - 1개: 자동 선택
// - 2개 이상: "AI 모델을 1개만 띄워주세요" — 어떤 모델을 쓸지 비결정적이라 차단
//
// 강제 지정 escape hatch: `.env` 의 OPEN_WEBUI_MODEL 명시 시 검증 우회 + 그 값 사용.
//
// 제외 대상: 임베딩 모델(`nomic-embed-*`) — chat 모델로 사용 불가.
//
// 호출 비용: localhost /api/ps ~5ms. chat 응답 자체가 수 초~수십 초이므로 무시 가능.
//
// 메모: Open WebUI 는 Ollama 모델을 동일 이름(예: gemma4-e4b-q4m-pure:latest)으로
// import 하므로 /api/ps 의 모델명을 그대로 Open WebUI /api/chat/completions 의 model 에 사용 가능.

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const NOT_AVAILABLE_MSG = 'AI 모델에 연결할 수 없습니다.';
const TOO_MANY_MSG = 'AI 모델을 1개만 띄워주세요';

interface OllamaPsModel {
  name?: string;
  model?: string;
}

const EXCLUDE_RE = /^nomic-embed/i;

export async function resolveOpenWebUiModel(): Promise<string> {
  const explicit = process.env.OPEN_WEBUI_MODEL?.trim();
  if (explicit) return explicit;

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/ps`);
  } catch {
    throw new Error(NOT_AVAILABLE_MSG);
  }
  if (!res.ok) throw new Error(NOT_AVAILABLE_MSG);

  const data = (await res.json().catch(() => ({}))) as { models?: OllamaPsModel[] };
  const models = Array.isArray(data?.models) ? data.models : [];
  const chats = models.filter((m) => {
    const name = (m?.name ?? m?.model ?? '').toString();
    return name !== '' && !EXCLUDE_RE.test(name);
  });
  if (chats.length === 0) throw new Error(NOT_AVAILABLE_MSG);
  if (chats.length > 1) {
    const names = chats
      .map((m) => (m.name ?? m.model ?? '').toString())
      .join(', ');
    throw new Error(`${TOO_MANY_MSG} (현재 ${chats.length}개 메모리 로드: ${names})`);
  }
  const id = (chats[0]?.name ?? chats[0]?.model ?? '').toString();
  if (!id) throw new Error(NOT_AVAILABLE_MSG);
  return id;
}
