import { OLLAMA_HOST } from "./config.js";

// 모델 Modelfile 기본값(128K)을 그대로 두고 호출 시점에 32K로 명시 고정.
// num_predict 는 답변 잘림 방지용 출력 토큰 budget.
const DEFAULT_CHAT_OPTIONS = { num_ctx: 32768, num_predict: 1024 };

// keep_alive=-1 → Ollama가 모델을 메모리에서 내리지 않도록 강제.
// 기본 5분 idle 언로드 시 첫 호출 cold-start 지연 + /api/ps 기반 health check 오판 회피.
// 모든 /api/* 호출에 동일 적용.
const KEEP_ALIVE_FOREVER = -1;

async function postJson(pathname, body) {
  const res = await fetch(`${OLLAMA_HOST}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${pathname} ${res.status}: ${text}`);
  }
  return res.json();
}

export async function embed(model, input) {
  const data = await postJson("/api/embed", { model, input, keep_alive: KEEP_ALIVE_FOREVER });
  const vec = data.embeddings?.[0];
  if (!Array.isArray(vec)) {
    throw new Error(`embed: invalid response for model ${model}`);
  }
  return vec;
}

// thinking-mode 모델(gemma 계열 26b 등)은 추론 단계를 `message.thinking` 으로,
// 답변을 `message.content` 로 분리 송출. RAG 답변은 검색된 컨텍스트를 정리하면 충분해
// thinking 토큰이 num_predict 예산을 잠식해 답변(content) 이 빈 문자열로 끝나는 사례 발생.
// `think:false` 로 thinking 단계를 명시 비활성 → content 즉시 생성.
// 비-thinking 모델(e4b 등) 은 이 옵션을 무시하므로 모든 모델에 안전하게 적용.
const THINK_OFF = { think: false };

export async function chat(model, messages, options = {}) {
  return postJson("/api/chat", {
    model,
    messages,
    stream: false,
    keep_alive: KEEP_ALIVE_FOREVER,
    ...THINK_OFF,
    options: { ...DEFAULT_CHAT_OPTIONS, ...options },
  });
}

// stream:true 호출 — Ollama 가 ndjson(line-delimited JSON) 으로 토큰 단위 응답.
// 호출자는 response.body 를 line 단위로 읽어 각 줄의 message.content 를 합치거나 forward.
export async function chatStreamRaw(model, messages, options = {}) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: KEEP_ALIVE_FOREVER,
      ...THINK_OFF,
      options: { ...DEFAULT_CHAT_OPTIONS, ...options },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama /api/chat ${res.status}: ${text}`);
  }
  return res; // body 는 호출자가 reader 로 직접 처리
}
