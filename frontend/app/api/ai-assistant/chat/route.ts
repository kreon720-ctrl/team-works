import { NextRequest, NextResponse } from 'next/server';
import { getSchedules, createSchedule, type Schedule } from '@/lib/mcp/scheduleQueries';
import { BackendError } from '@/lib/mcp/pgClient';
import { resolveOpenWebUiModel } from '@/lib/openWebUiModel';

// Next.js 16 의 API route default maxDuration 이 300초(5분) 라서
// 큰 채팅 모델 + 검색 결과 컨텍스트의 답변 생성이 그 이상 걸리면 강제 종료된다.
// 10분(600s)으로 명시 확장.
export const maxDuration = 600;

const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://127.0.0.1:8787';
const OPEN_WEBUI_BASE_URL =
  process.env.OPEN_WEBUI_BASE_URL || 'http://127.0.0.1:8081';
const OPEN_WEBUI_API_KEY = process.env.OPEN_WEBUI_API_KEY || '';
// Open WebUI 채팅 모델 이름은 매 호출 시 Open WebUI /api/models 로 자동 해석
// (lib/openWebUiModel.ts). `OPEN_WEBUI_MODEL` env 가 명시되면 그 값 우선 사용.
// Open WebUI 의 OpenAI-compatible 응답은 URL 메타데이터를 노출하지 않음.
// sources 보강용으로 SearxNG 를 같은 쿼리로 한 번 더 호출해 URL/title 을 직접 채운다.
const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL || '';

interface WebSource {
  title?: string;
  url?: string;
  source_file?: string;
  section_path?: string;
  score?: number;
}

// Open WebUI v0.9 의 OpenAI-compatible 응답은 sources/citations 별도 필드를 노출하지 않는다.
// 모델이 답변 본문에 출처 URL 을 직접 인용하는 패턴이 표준이므로, 본문에서 URL 을 정규식 추출해
// sources 배열을 구성한다. (구버전·변형 응답을 위해 표준 필드도 함께 점검.)
const URL_RE = /https?:\/\/[^\s<>'"`)\]]+/g;

function extractWebSources(payload: unknown, answerText: string): WebSource[] {
  // 1) 표준 필드 우선 — 향후 Open WebUI 가 citations 를 표준화하면 자동 대응
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const choice = Array.isArray(p.choices) ? (p.choices[0] as Record<string, unknown>) : undefined;
    const msg = choice?.message as Record<string, unknown> | undefined;
    const candidates = [
      p.sources, p.citations, p.web_search_results,
      msg?.sources, msg?.citations, msg?.annotations,
    ];
    for (const c of candidates) {
      if (Array.isArray(c) && c.length > 0) {
        return c
          .map((s) => {
            const item = (s ?? {}) as Record<string, unknown>;
            const url =
              (typeof item.url === 'string' && item.url) ||
              (typeof item.link === 'string' && item.link) ||
              (typeof item.source === 'string' && item.source) ||
              undefined;
            const title =
              (typeof item.title === 'string' && item.title) ||
              (typeof item.name === 'string' && item.name) ||
              undefined;
            return { url, title };
          })
          .filter((s) => s.url || s.title);
      }
    }
  }

  // 2) Fallback — 답변 본문의 URL 추출. 중복 제거.
  if (!answerText) return [];
  const found = new Set<string>();
  for (const m of answerText.matchAll(URL_RE)) {
    let url = m[0];
    // 끝의 마침표·쉼표·따옴표 등을 trim
    url = url.replace(/[.,;:!?'")\]]+$/, '');
    found.add(url);
  }
  return [...found].map((url) => ({ url, title: hostnameOf(url) }));
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

// RAG 서버가 런타임에 해석한 채팅 모델명을 가져옴 (`/health` 가 modelResolver 결과 노출).
// UI 푸터 표시용. 실패 시 undefined → UI 는 fallback 텍스트로 처리.
async function fetchRagModel(): Promise<string | undefined> {
  try {
    const res = await fetch(`${RAG_SERVER_URL}/health`);
    if (!res.ok) return undefined;
    const data = await res.json();
    return typeof data?.model === 'string' ? data.model : undefined;
  } catch {
    return undefined;
  }
}

async function callRagChat(question: string, topK?: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 540000);
  const res = await fetch(`${RAG_SERVER_URL}/chat`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(topK ? { question, topK } : { question }),
  }).finally(() => clearTimeout(t));
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `RAG 서버 오류 (${res.status})`);
  }
  return JSON.parse(text);
}

// 모델 프리셋의 system prompt 와 무관하게 매 호출마다 강제 적용하는 추가 시스템 프롬프트.
// 검색 결과 본문 인용·출처 URL 명시를 강하게 요구해 sources 추출(URL 정규식)이 일관되게 동작하도록 함.
//
// 매 호출마다 KST 오늘 날짜를 주입 — 모델이 자체 training cutoff 를 "오늘" 으로 가정해
// "내일" / "어제" / "오늘" 을 잘못 해석하는 것 방지. 일정 관련 prompt (parse-schedule-*) 와 동일 패턴.
function buildOpenWebUiSystemPrompt(): string {
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKst = nowKst.toISOString().slice(0, 10);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][nowKst.getUTCDay()];
  return `당신은 TEAM WORKS 의 AI 비서 "찰떡"입니다.

현재 KST 날짜: ${todayKst} (${wd}요일)
사용자가 "오늘", "내일", "어제", "이번 주", "다음 주" 같은 상대 날짜·시점 표현을 사용하면 반드시 위 KST 날짜 기준으로 해석. 절대 본인의 학습 컷오프 날짜로 추론 금지.

사용자가 일반 질문(TEAM WORKS 사용법과 무관한 시사·날씨·코딩·지식 등)을 했고, 시스템이 웹 검색 결과를 컨텍스트로 제공했습니다.

답변 규칙 (반드시 준수):
1. 한국어로 친절하고 간결하게 답합니다.
2. 검색 결과의 본문을 사실 기반으로 인용해 구체적으로 답합니다. 추측·일반론 금지.
3. 검색 결과에 정보가 없거나 불충분하면 솔직히 "검색 결과에서 확인되지 않았다" 고 말하고, 사용자가 직접 확인할 키워드 두세 개를 제안합니다.
4. **답변 마지막에 반드시 다음 형식으로 출처를 명시** (출처가 없으면 답변 자체를 거절):
   출처:
   - https://example.com/...
   - https://example.com/...
5. 출처 URL 은 인라인 마크다운 링크가 아닌 위 목록 형태로 1~3개 명시. 본문에서 인용한 출처만 표기.
6. 단위는 한국 표준으로 통일: 온도는 °C, 거리는 km/m, 통화는 원(KRW). 검색 결과가 °F·mile·USD 등 다른 단위로 되어 있어도 한국 표준으로 변환해서 답하고, 원본 단위는 표기하지 않음.`;
}

async function callOpenWebUi(question: string) {
  if (!OPEN_WEBUI_API_KEY) {
    throw new Error(
      'OPEN_WEBUI_API_KEY 가 설정되어 있지 않습니다. 루트 .env 에 키를 추가한 후 frontend 컨테이너를 재기동해 주세요.'
    );
  }
  // 1) SearxNG 직접 검색 (~2초). web_search 를 Open WebUI 에 맡기면 5분+ 직렬 대기.
  const hits = await searxngFetch(question, 5);
  const systemContent = buildOpenWebUiSystemPrompt() + hitsToContextBlock(hits);
  const model = await resolveOpenWebUiModel();

  // Node.js undici(fetch 구현) 의 기본 receive timeout 이 5분(300초)이라
  // Open WebUI + 큰 채팅 모델 답변이 그 이상 걸리면 끊긴다. 9분으로 명시 확장.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 540000);
  const res = await fetch(`${OPEN_WEBUI_BASE_URL}/api/chat/completions`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPEN_WEBUI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: question },
      ],
      // 검색은 frontend 가 이미 했음 — Open WebUI 측 web_search 비활성
      features: { web_search: false },
      // 답변 토큰 수 캡 — decode 시간 단축. 출처 인용 포함해 충분.
      options: { num_predict: 800 },
      stream: false,
    }),
  }).finally(() => clearTimeout(t));
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Open WebUI 오류 (${res.status})`);
  }
  const data = JSON.parse(text);
  const content =
    data?.choices?.[0]?.message?.content ??
    (typeof data?.message === 'string' ? data.message : '') ??
    '';
  const answer = String(content).trim();
  let sources = extractWebSources(data, answer);
  // Open WebUI 가 URL 메타를 안 줘서 정규식 추출도 실패하는 경우 SearxNG 직접 호출로 보강.
  if (sources.length === 0) {
    sources = await searxngQuery(question);
  }
  return { answer, sources };
}

// SearxNG 직접 호출로 URL/title/snippet 을 가져와 (1) sources 보강 (2) inline 컨텍스트 주입.
// Open WebUI 의 web_search 는 검색·web_loader 단계가 직렬로 5분+ 소요해 stream 효과를 가림.
// frontend 가 SearxNG 를 직접 호출해 결과를 모델 메시지에 inline 으로 넣고 Open WebUI 의 web_search 는 비활성하면
// 모델 답변 토큰이 즉시 stream 시작 가능.
interface WebHit {
  title: string;
  url: string;
  content: string; // SearxNG snippet (~120~200자, 페이지 핵심 발췌)
}

async function searxngFetch(question: string, limit = 5): Promise<WebHit[]> {
  if (!SEARXNG_BASE_URL) return [];
  try {
    const url = `${SEARXNG_BASE_URL}/search?q=${encodeURIComponent(question)}&format=json`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .slice(0, limit)
      .map((r: Record<string, unknown>) => ({
        title: typeof r.title === 'string' ? r.title : '',
        url: typeof r.url === 'string' ? r.url : '',
        content: typeof r.content === 'string' ? r.content : '',
      }))
      .filter((h: WebHit) => h.url);
  } catch {
    return [];
  }
}

function hitsToSources(hits: WebHit[]): WebSource[] {
  return hits.map((h) => ({ title: h.title, url: h.url }));
}

// SearxNG 결과를 system prompt 에 동봉할 컨텍스트 블록으로 변환.
function hitsToContextBlock(hits: WebHit[]): string {
  if (!hits.length) return '';
  const blocks = hits.map((h, i) => {
    const head = `[${i + 1}] ${h.title || '(제목 없음)'}\nURL: ${h.url}`;
    const body = h.content ? `\n${h.content}` : '';
    return head + body;
  });
  return `\n\n# 웹 검색 결과 (참고 자료)\n\n${blocks.join('\n\n')}`;
}

// 하위 호환 alias — 기존 sources 보강 경로(non-stream RAG fallback) 가 사용
async function searxngQuery(question: string, limit = 5): Promise<WebSource[]> {
  const hits = await searxngFetch(question, limit);
  return hitsToSources(hits);
}

// ── Streaming helpers ─────────────────────────────────────────────
// SSE 이벤트 타입:
//   meta:    { type:'meta', source:'rag'|'web', classification }
//   token:   { type:'token', text }
//   sources: { type:'sources', sources: WebSource[] }
//   error:   { type:'error', message }
//   [DONE]:  종료

type SendFn = (obj: Record<string, unknown>) => void;

// Ollama ndjson 또는 OpenAI SSE 응답 본문을 line 단위로 파싱.
// rag/server.js 는 SSE("data: {...}\n\n"), Open WebUI 는 OpenAI SSE("data: {...}\n\n").
async function forwardSseTokens(
  upstreamBody: ReadableStream<Uint8Array>,
  send: SendFn,
  parseChunk: (raw: string) => string | null
) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const tok = parseChunk(data);
        if (tok) send({ type: 'token', text: tok });
      } catch {
        // 파싱 실패는 무시
      }
    }
  }
}

// rag/server.js 의 SSE 청크: { type:'sources'|'token', ... }
async function streamRag(question: string, topK: number | undefined, send: SendFn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 540000);
  const res = await fetch(`${RAG_SERVER_URL}/chat`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, ...(topK ? { topK } : {}), stream: true }),
  }).finally(() => clearTimeout(t));
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `RAG 서버 오류 (${res.status})`);
  }
  await forwardSseTokens(res.body, send, (data) => {
    const obj = JSON.parse(data);
    if (obj.type === 'sources' && Array.isArray(obj.sources)) {
      send({ type: 'sources', sources: obj.sources });
      return null;
    }
    if (obj.type === 'token' && typeof obj.text === 'string') return obj.text;
    if (obj.type === 'error') throw new Error(obj.message);
    return null;
  });
}

// Open WebUI 의 web_search 는 검색·web_loader 가 직렬로 5분+ 걸려 stream 효과를 가림.
// 우리가 SearxNG 를 직접 호출해 결과를 inline 컨텍스트로 system prompt 에 주입하고
// Open WebUI 의 web_search 는 비활성. 검색 ~2초 후 곧장 모델 stream 시작.
//
// thinking-mode 모델은 답변(content) 전에 reasoning_content 단계가 흐른다.
// 사용자에게 첫 시그널을 빠르게 주기 위해 reasoning 시작 시 progress 한 번 송출.
// (비-thinking 모델이면 이 단계 없이 곧장 content 시작 — 분기는 무해.)
async function streamOpenWebUi(question: string, send: SendFn) {
  if (!OPEN_WEBUI_API_KEY) {
    throw new Error(
      'OPEN_WEBUI_API_KEY 가 설정되어 있지 않습니다. 루트 .env 에 키를 추가한 후 frontend 컨테이너를 재기동해 주세요.'
    );
  }
  // 1) SearxNG 직접 검색 → snippet 포함 hits 획득
  const hits = await searxngFetch(question, 5);
  // 2) 출처를 stream 시작 직후 미리 송출 (UI 가 토큰 도착 전에 출처 카드 렌더 가능)
  if (hits.length) send({ type: 'sources', sources: hitsToSources(hits) });
  // 3) 검색 결과를 system prompt 에 inline 주입
  const systemContent = buildOpenWebUiSystemPrompt() + hitsToContextBlock(hits);
  const model = await resolveOpenWebUiModel();

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 540000);
  const res = await fetch(`${OPEN_WEBUI_BASE_URL}/api/chat/completions`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPEN_WEBUI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: question },
      ],
      // web_search 비활성 — 검색은 frontend 가 이미 했고 inline 으로 주입됨
      features: { web_search: false },
      options: { num_predict: 800 },
      stream: true,
    }),
  }).finally(() => clearTimeout(t));
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Open WebUI 오류 (${res.status})`);
  }
  let reasoningStarted = false;
  await forwardSseTokens(res.body, send, (data) => {
    const obj = JSON.parse(data);
    const delta = obj?.choices?.[0]?.delta ?? {};
    if (typeof delta.content === 'string' && delta.content) return delta.content;
    if (
      !reasoningStarted &&
      typeof delta.reasoning_content === 'string' &&
      delta.reasoning_content
    ) {
      reasoningStarted = true;
      // progress 시그널 — page.tsx 가 별도 처리해 한 번만 표시
      send({ type: 'progress', text: '🔎 검색 결과를 분석 중…' });
    }
    return null;
  });
}

// classify — RAG 서버 4-way 의도 분류기 호출.
// 응답: { intent, reason?, subreason?, matched?, isTeamWorks }
type Intent =
  | 'usage'
  | 'general'
  | 'schedule_query'
  | 'schedule_create'
  | 'schedule_delete'
  | 'schedule_update'
  | 'blocked'
  | 'unknown';

interface Classification {
  intent: Intent;
  reason?: string;
  subreason?: string; // blocked 의 종류 — 'schedule_modify' | 'other_domain'
  matched?: string;
  isTeamWorks?: boolean;
}

async function classify(question: string): Promise<Classification> {
  try {
    const res = await fetch(`${RAG_SERVER_URL}/classify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return { intent: 'unknown', reason: 'classify-error' };
    return (await res.json()) as Classification;
  } catch {
    return { intent: 'unknown', reason: 'classify-error' };
  }
}

// LLM 이 가끔 일반 명사를 keyword 로 추출 → 안전망으로 빈 문자열 강제.
// (예: "지난주 일정 정리" → keyword="일정" 잘못 추출 → 제목에 "일정" 포함된 것만 살아남는 버그)
//
// 정책:
// - 일정/스케줄: 너무 일반적이라 모든 이벤트와 매치 → 차단 (필터 의미 없음).
// - 메타 동사·의문사: 제목에 절대 안 들어감 → 차단.
// - 회의/미팅/약속/이벤트/행사: 제목에 흔히 등장하므로 사용자가 입력하면 그대로 필터.
//   "이번 주 회의 일정" → keyword="회의" → "%회의%" 부분 매치.
const KEYWORD_STOPWORDS = new Set([
  '일정', '스케줄',
  '정리', '알려', '보여', '확인', '조회', '찾아',
  '있어', '있나', '있는', '있는지', '어떤', '뭐', '뭐가', '무엇',
  '검색', '검색해', '검색해줘',
  // schedule_update / schedule_delete 메타 동사 — title 에 절대 안 들어가는 동작어.
  // 작은 모델이 "어제 회의 수정" 같이 동사를 keyword 로 추출하는 환각 차단.
  '수정', '변경', '바꿔', '옮겨', '옮기', '삭제', '제거', '지워', '지운',
  '등록', '추가', '만들', '잡아', '예약', '넣어', '생성',
  // 필드명 — "회의 제목 변경" / "회의 색깔 바꿔줘" 류에서 의미 없는 필드명이 keyword 로 들어감.
  '제목', '시간', '시각', '색깔', '색상', '색', '설명', '메모',
  // 순수 시간대 단어 — detectTimeBand 가 band 필터로 처리. keyword 추출 안 함.
  // (아침/점심/저녁/야식 같은 식사·이벤트성 단어는 stopword 에서 제외 — 제목/설명 keyword
  // 매치 우선. 실제 사용자 일정의 30%+ 가 '점심 약속' 같은 식사 약속이라 시간대보다
  // 이벤트 명사로 검색하는 게 자연스러움. OBJECTIVE_BANDS 에서도 함께 제거.)
  '오전', '오후', '새벽', '밤',
  // 양 한정사 — "전체 회의 정리해줘" 류에서 "전체" 단독은 keyword 가 아니라 양 표현.
  '전체', '전부', '모두', '모든', '다',
]);

// 합성 keyword 의 stopword 토큰 제거.
// 예: "주 회의" → "주" / "디자인 리뷰" → "디자인 리뷰"
// "주" 같은 view 표지자가 붙은 합성어를 의미 있는 부분만 남기고 정리.
function sanitizeKeyword(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  if (KEYWORD_STOPWORDS.has(t)) return '';
  // 숫자 시점 패턴 — 작은 LLM 이 "8일" / "5월 8일" / "5월" / "5/8" 같은 시점 단서를
  // keyword 로 환각하는 케이스 차단. 이런 표현은 view+date 로 처리되어야지 keyword 매치
  // 대상이 아님 (제목에 "8일" 들어간 일정만 검색해서 0건이 되는 사이드이펙트 방지).
  if (/^\d{1,2}\s*월\s*\d{1,2}\s*일$/.test(t)) return '';
  if (/^\d{1,2}\s*월$/.test(t)) return '';
  if (/^\d{1,2}\s*일$/.test(t)) return '';
  if (/^\d{1,2}\s*[./]\s*\d{1,2}\.?$/.test(t)) return '';
  // 공백 단위로 토큰 나눠 합성 suffix 제거 + stopword 토큰 + view 표지자 ("주") 제거.
  // 합성 suffix: "조사일정"·"회의일정"·"운동스케줄" 처럼 띄어쓰기 없이 붙은 메타 noun 분리.
  const VIEW_MARKERS = new Set(['주', '주간', '오늘', '내일', '어제', '이번', '다음', '지난']);
  const tokens = t.split(/\s+/)
    .map((tok) => tok.replace(/(일정|스케줄|뭐있어|뭐있나|있어|있나|있는지|있는|뭐가|뭐|검색해줘|검색해|검색)$/, ''))
    .filter((tok) => {
      if (!tok) return false;
      if (KEYWORD_STOPWORDS.has(tok)) return false;
      if (VIEW_MARKERS.has(tok)) return false;
      // 숫자 단위 토큰 — "8일", "5월" 단독 토큰은 keyword 아님.
      if (/^\d{1,2}\s*(?:월|일|시|분|주)$/.test(tok)) return false;
      return true;
    });
  t = tokens.join(' ').trim();
  if (!t) return '';
  if (KEYWORD_STOPWORDS.has(t)) return '';
  return t;
}

// LLM 이 keyword="" 환각으로 떨어뜨린 경우 사용자 질문에서 직접 추출하는 fallback.
// "전체 회의 일정 정리해줘" → LLM 이 "전체" 양 한정사 + "회의 일정" 메타 결합을 보고 빈 문자열을
// 반환하는 사례 (e4b 환각) 차단용. sanitizeKeyword 와 동일한 stopword·정규식을 재사용.
function extractKeywordFallback(question: string): string {
  // 종결 어미·구두점 제거
  let s = question
    .replace(/[?!.,]/g, ' ')
    .replace(/(해주세요|해드려|해드릴|해줘|드려|봐줘|해|줘|입니다|입니까|이다|한다|하자|예요|이에요)/g, ' ');
  // 시점 패턴 제거 (X월 Y일·X일·X시·이번주·다음달 등 — sanitizeKeyword 와 동일 정책)
  s = s.replace(/\d+\s*월\s*\d+\s*일/g, ' ');
  s = s.replace(/\d+\s*월/g, ' ');
  s = s.replace(/\d+\s*일/g, ' ');
  s = s.replace(/\d+\s*시(?:\s*\d+\s*분)?/g, ' ');
  s = s.replace(/(이번|다음|지난)\s*(주간|주|달)/g, ' ');
  // 한국어 조사 — 명사 뒤에 붙는 짧은 조사 제거.
  // "의" 는 의도적으로 제외 — "회의·의자·의사" 처럼 명사 끝 음절로도 자주 등장 (false strip 차단).
  // "로"·"으로" 는 "새로·바로" 같은 부사와 충돌 가능성 있어 제외.
  s = s.replace(/([가-힣])(이|가|을|를|은|는|에|도|만|와|과|에서|부터|까지)(?=\s|$)/g, '$1');
  const VIEW_MARKERS = new Set(['주', '주간', '오늘', '내일', '어제', '모레', '글피', '이번', '다음', '지난']);
  // 합성 suffix 제거 후 stopword·view-marker·숫자 토큰 필터.
  const tokens = s.split(/\s+/)
    .map((tok) => tok.replace(/(일정|스케줄|뭐있어|뭐있나|있어|있나|있는지|있는|뭐가|뭐|검색해줘|검색해|검색)$/, ''))
    .filter((tok) => {
      if (!tok) return false;
      if (KEYWORD_STOPWORDS.has(tok)) return false;
      if (VIEW_MARKERS.has(tok)) return false;
      if (/^\d+$/.test(tok)) return false; // 순수 숫자
      if (/^\d+\s*(?:월|일|시|분|주)$/.test(tok)) return false;
      return true;
    });
  return tokens.join(' ').trim();
}

// "X월 Y일 주" / "X일 주" — 특정 날짜를 포함하는 주(week) 표현.
// (?!간) 으로 "주간" 은 제외 (주간 = 별도 단어).
// 약식 도트·슬래시 표기 ("5.4. 주", "5/4 주") 도 흡수 — 한국에서 일자 약식 자주 사용.
const WEEK_OF_DATE_RE =
  /(?:\d+월\s*)?\d+일\s*주(?!간)|(?<![\d.])\d{1,2}\s*[./]\s*\d{1,2}\s*\.?\s*주(?!간)/;

// 사용자 입력에 "주" 글자 (week token) 가 있나 — "주간" 은 별도 단어라 제외.
// 작은 모델이 "X일 일정" 을 system prompt 의 예시 "X일 주 일정" 패턴으로 착각해
// view=week 로 떨어뜨리는 환각을 잡기 위한 negative signal.
const HAS_WEEK_TOKEN_RE = /주(?!간)/;

// 특정 날짜 시그널 — "X월 Y일", "X/Y", "X.Y" / "X.Y." (약식), "어제/오늘/내일" 등.
// HAS_WEEK_TOKEN_RE 가 false 인데 이게 true 면 사용자는 단일 날짜 의도가 명확.
// 약식 점·슬래시 표기 — 한국에서 흔히 쓰임 (5.1., 5/1).
// "Y일" 일자 단독 — 작은 LLM 이 "8일" 같은 단독 일자를 view=week + 오늘 날짜로 환각하는
// 케이스 차단용. 앞뒤로 숫자 없을 때만 매치 (X월 Y일의 Y일과 구분 — 그건 1번 분기에서 처리).
const SPECIFIC_DATE_RE =
  /\d+월\s*\d+일|\d+\s*\/\s*\d+|\d+\s*\.\s*\d+\.?(?!\d)|어제|오늘|내일|모레|글피|(?<!\d)\d{1,2}\s*일(?!\d)/;

// 특정 날짜 패턴들을 결정론적으로 추출 — LLM 의 환각/fallback 을 무시하고 사용자 입력 그대로 사용.
// 우선순위: "X월 Y일" → "X.Y." → "X/Y" → "X.Y". 매치 안 되면 null.
// 연도는 현재 연도 (조회는 과거·미래 양방향 가능하므로 휴리스틱 X).
function extractSpecificDateYmd(question: string): string | null {
  // 1) 정식 표기 "X월 Y일"
  const formal = question.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (formal) {
    return buildYmd(parseInt(formal[1], 10), parseInt(formal[2], 10));
  }
  // 2) 약식 점·슬래시 — "5.1.", "5.1", "5/1". 앞뒤로 다른 숫자 없을 때만 (소수·분수 false positive 회피).
  const shorthand = question.match(/(?<![\d.])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d])/);
  if (shorthand) {
    return buildYmd(parseInt(shorthand[1], 10), parseInt(shorthand[2], 10));
  }
  // 3) "Y일" 일자 단독 — 월 미명시. 현재 KST 의 같은 달 Y일로 결정 (사용자 의도가 보통 동일 달).
  // lookahead 는 즉시 다음 char 만 검사 — "13일 10시" 처럼 공백 사이의 다른 의미 숫자는 통과.
  const dayOnly = question.match(/(?<!\d)(\d{1,2})\s*일(?!\d)/);
  if (dayOnly) {
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return buildYmd(nowKst.getUTCMonth() + 1, parseInt(dayOnly[1], 10));
  }
  return null;
}

function buildYmd(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const year = new Date().getUTCFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// "(다음|이번|지난)주 + 요일" — 단일 요일 표현. LLM 이 "주" 만 보고 view=week 로
// 잘못 떨어뜨리는 케이스를 정규식으로 잡아 view=day + 정확한 날짜로 강제 보정.
// "주" 는 optional — "이번 화요일", "지난 월요일" 같이 주 생략 표현도 같은 의미로 매치.
const WEEKDAY_RELATIVE_RE = /(다음|이번|지난)\s*주?\s*(월|화|수|목|금|토|일)요일/;
const WEEKDAY_OFFSET: Record<string, number> = {
  일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6,
};

// 단독 "X요일" — 다음/이번/지난 prefix 없는 요일 표현. 작은 LLM(e4b) 이 "지난주 X요일"
// 로 환각하는 사례 (예: 일요일 오늘 기준 "금요일" → 5/8 출력) 차단용 결정적 처리.
// 합성어 가드: 앞 글자가 한글이면 패스 (예: 의도치 않은 매몰 표현 회피).
const BARE_WEEKDAY_RE = /(?<![가-힣])(월|화|수|목|금|토|일)요일/;

// "(다음|이번|지난)주 X요일" 매치 시 KST 기준 정확한 날짜를 YYYY-MM-DD 로 계산.
// 매치 안되면 null. 주의 시작은 일요일 — 백엔드 getKstDateRange / CalendarView 의
// 달력 정의와 일치 (일~토 7일).
function resolveRelativeWeekday(question: string): string | null {
  const m = question.match(WEEKDAY_RELATIVE_RE);
  if (!m) return null;
  const [, rel, dayChar] = m;
  // KST 기준 오늘 (Date 를 +9h offset 한 가상 UTC 프레임에서 계산)
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayDow = nowKst.getUTCDay(); // 0(일)~6(토) — 그대로 일요일까지의 일수
  const thisSun = new Date(nowKst);
  thisSun.setUTCDate(nowKst.getUTCDate() - todayDow);
  const weekOffset = rel === '다음' ? 7 : rel === '지난' ? -7 : 0;
  const target = new Date(thisSun);
  target.setUTCDate(thisSun.getUTCDate() + weekOffset + WEEKDAY_OFFSET[dayChar]);
  return target.toISOString().slice(0, 10);
}

// 단독 "X요일" 매치 시 **현재일 이후 가장 가까운 그 요일** 날짜를 YYYY-MM-DD 로 반환.
// (오늘이 그 요일이면 오늘 반환). (다음|이번|지난) prefix 가 있으면 resolveRelativeWeekday
// 가 우선 처리하므로 여기선 무시. 매치 안 되면 null.
//
// 의도: "수요일 일정" 처럼 prefix 없는 표현은 사용자가 보통 "다가오는 수요일" 을 지칭함.
// 작은 LLM(e4b) 이 이를 "지난주 수요일" 로 환각하던 문제도 함께 차단.
function resolveBareWeekday(question: string): string | null {
  // resolveRelativeWeekday 와 중복 매치 방지 — 거기서 처리되면 여기는 패스.
  if (WEEKDAY_RELATIVE_RE.test(question)) return null;
  const m = question.match(BARE_WEEKDAY_RE);
  if (!m) return null;
  const dayChar = m[1];
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayDow = nowKst.getUTCDay();
  const targetDow = WEEKDAY_OFFSET[dayChar];
  // 오늘 포함 가장 가까운 미래 요일까지의 일수. 오늘이 그 요일이면 0.
  const daysAhead = (targetDow - todayDow + 7) % 7;
  const target = new Date(nowKst);
  target.setUTCDate(nowKst.getUTCDate() + daysAhead);
  return target.toISOString().slice(0, 10);
}

// "(다음|이번|지난)주" 단독 — 요일 미지정 주 단위 시점 표현. "주간" 은 별도 단어라 제외.
// 작은 모델이 "지난주" 를 view=day + 임의 날짜로 잘못 떨어뜨리는 환각을 정규식으로 잡아
// view=week + 해당 주의 임의 날짜로 강제 보정. WEEKDAY_RELATIVE_RE 보다 후순위 (요일 명시면 day 우선).
const RELATIVE_WEEK_RE = /(다음|이번|지난)\s*주(?!간)/;

// RELATIVE_WEEK_RE 매치 시 해당 주에 속한 날짜를 YYYY-MM-DD 로 반환. 매치 안 되면 null.
// 백엔드 getKstDateRange(view=week) 는 주어진 날짜가 속한 일~토 주를 자동 계산하므로
// 굳이 주 경계로 정렬할 필요 없이 오늘 ± 7일만 넘겨도 충분.
function resolveRelativeWeek(question: string): string | null {
  const m = question.match(RELATIVE_WEEK_RE);
  if (!m) return null;
  const [, rel] = m;
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const weekOffset = rel === '다음' ? 7 : rel === '지난' ? -7 : 0;
  const target = new Date(nowKst);
  target.setUTCDate(nowKst.getUTCDate() + weekOffset);
  return target.toISOString().slice(0, 10);
}

// schedule 조회 자연어 → view+date+keyword 파싱 — RAG 서버의 /parse-schedule-query.
// keyword 는 일정 제목 부분 매치용 (예: "디자인 리뷰"). 실패 시 default(month/오늘/no-keyword) fallback.
//
// 후처리: 작은 모델이 "X일 주" 를 view=day 로 잘못 떨어뜨리는 케이스를 정규식으로 강제 보정.
async function parseScheduleQuery(question: string): Promise<{
  view: 'day' | 'week' | 'month';
  date: string;
  keyword: string;
}> {
  try {
    const res = await fetch(`${RAG_SERVER_URL}/parse-schedule-query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, nowIso: new Date().toISOString() }),
    });
    const data = await res.json();
    let view = (data?.view ?? 'month') as 'day' | 'week' | 'month';
    let date = (data?.date ?? new Date().toISOString().slice(0, 10)) as string;
    // 요일 표현 우선 매치 — view=day 로 강제 (가장 구체적):
    //  1) "(다음|이번|지난)주 X요일" — resolveRelativeWeekday
    //  2) 단독 "X요일" — resolveBareWeekday (이번주 기준 해당 요일)
    // 둘 다 매치 안 되면 "(다음|이번|지난)주" 단독 → view=week.
    const weekdayDate = resolveRelativeWeekday(question) ?? resolveBareWeekday(question);
    const weekDate = !weekdayDate ? resolveRelativeWeek(question) : null;
    if (weekdayDate) {
      view = 'day';
      date = weekdayDate;
    } else if (weekDate) {
      // "(다음|이번|지난)주" 단독이면 view=week + 해당 주 월요일로 강제
      view = 'week';
      date = weekDate;
    } else if (WEEK_OF_DATE_RE.test(question)) {
      // "X일 주" / "X.Y. 주" / "X/Y 주" 패턴이면 view=week 강제 (LLM 이 day 로 떨어뜨려도 정정).
      // date 도 결정적 추출 — LLM 이 약식 도트 표기 ("5.4. 주") 를 4월 5일로 환각하는 사례 차단.
      view = 'week';
      const extracted = extractSpecificDateYmd(question);
      if (extracted) date = extracted;
    } else if (
      SPECIFIC_DATE_RE.test(question) &&
      !HAS_WEEK_TOKEN_RE.test(question)
    ) {
      // 작은 양자화 모델 (e4b 등) 의 환각 + LLM 호출 실패 fallback (view=month) 모두 흡수.
      // 사용자 입력에 "주" 글자 자체가 없고 특정 날짜만 있으면 단일 날짜 의도가 명확 → day 강제.
      // view='day' 케이스도 포함 — LLM 이 day 로 잘 분류해도 date 를 환각 (8일 → 5/18) 하는
      // 사례가 있어 명시적 날짜 단서가 있으면 항상 deterministic 추출 결과로 override.
      view = 'day';
      const extracted = extractSpecificDateYmd(question);
      if (extracted) date = extracted;
    } else if (!HAS_TIMING_SIGNAL_RE.test(question)) {
      // 시점 단서 전혀 없는 키워드 검색 ("전체회의 정리해줘") 에 대해 LLM 이 view=week/day 로
      // 환각하는 사례 차단 — view=month + 오늘 강제. runScheduleQuery 의 미래 lookahead
      // 분기가 동작하기 위한 전제 조건.
      view = 'month';
      date = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    // keyword 환각 보정 — LLM 이 빈 문자열을 반환했으면 질문에서 직접 추출 fallback.
    let finalKeyword = typeof data?.keyword === 'string' ? sanitizeKeyword(data.keyword) : '';
    if (!finalKeyword) finalKeyword = extractKeywordFallback(question);
    return { view, date, keyword: finalKeyword };
  } catch {
    return {
      view: 'month',
      date: new Date().toISOString().slice(0, 10),
      keyword: '',
    };
  }
}

// 한국어 띄어쓰기 변형 무관 매칭을 위한 정규화 — 모든 공백 제거 + 소문자화.
// "디자인 리뷰" / "디자인리뷰" / "디자인  리뷰" 모두 "디자인리뷰" 로 정규화돼 양방향 매치.
function normalizeForKeywordMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

// keyword 가 있으면 title/description 부분 매치 (대소문자·띄어쓰기 무시). 빈 keyword 면 그대로 통과.
function filterByKeyword<T extends { title: string; description: string | null }>(
  schedules: T[],
  keyword: string
): T[] {
  if (!keyword) return schedules;
  const k = normalizeForKeywordMatch(keyword);
  return schedules.filter((s) => {
    const titleN = normalizeForKeywordMatch(s.title);
    const descN = s.description ? normalizeForKeywordMatch(s.description) : '';
    return titleN.includes(k) || descN.includes(k);
  });
}

// 시간대 — KST 기준 시(hour) 범위로 startAt 필터링.
// 한국어 일상 표현으로 시간 범위가 합리적으로 합의되는 키워드는 OBJECTIVE 로 자동 매핑.
// 자정을 가로지르거나 사람마다 경계 차이가 큰 야식 만 AMBIGUOUS 유지.
type TimeBand = { start: number; end: number; label: string };

const OBJECTIVE_BANDS: Record<string, TimeBand> = {
  오전: { start: 0, end: 12, label: '오전' },
  오후: { start: 12, end: 24, label: '오후' },
  // 일상 시간대 — 한국어 관습 기반 합리 범위. 칼같이 맞을 필요 없음 (조회는 약간 넓게 잡혀도 OK).
  // 아침/점심/저녁/야식 은 시간대보다 식사·이벤트 명사로 쓰이는 비율이 압도적이라 band 에서 제외.
  // (예: '직원 점심 일정 조회' 는 11~14시 startAt 필터가 아니라 제목/설명에 '점심' 들어간 일정 검색.)
  // KEYWORD_STOPWORDS 에서도 함께 제거되어 keyword 추출 대상이 됨.
  새벽: { start: 0, end: 6, label: '새벽' },
  밤: { start: 21, end: 24, label: '밤' },
};

// 자정 가로지르는 식의 모호 시간대 — 현재 없음. 야식은 keyword 로 이동.
const AMBIGUOUS_BANDS: string[] = [];

const HAS_SPECIFIC_TIME = /\d+\s*시|\d+\s*[:：]\s*\d+/;

// 시간대 명사 뒤에 자연스럽게 오는 한국어 조사·의존명사 — 이게 따라오면 합성어가 아니라
// 단독 시간대 단어. 길이 2 → 1 순으로 매치. (예: "점심에는" → "에는" 매치)
const TIME_PARTICLES = [
  '에서', '에는', '에도', '에만', '부터', '까지', '으로',
  '에', '은', '는', '이', '가', '을', '를', '도', '의', '와', '과', '로', '만', '쯤', '때',
];

// 시간대 명사 뒤에 메타 noun ("일정"·"스케줄") 이 붙은 띄어쓰기 누락 표현은
// 합성어가 아니라 "시간대 + 메타" 의 구어 결합 — 단독 시간대로 인식해야 band 가 동작.
// (예: "점심일정 수정" 은 "점심 일정 수정" 과 같은 의미.)
const TIME_META_NOUNS = ['일정', '스케줄'];

// 시간대 키워드(점심·저녁 등)가 합성어 안에 매몰되어 있는지 검사.
// 합성어 판정: 앞 또는 뒤에 한글 음절이 붙어 있으면 합성어 — 단독 매치 아님.
//  - 앞 합성: "직원점심"·"오늘점심" 처럼 시간대 단어 앞에 한글
//  - 뒤 합성: "점심약속"·"저녁식사" 처럼 시간대 단어 뒤에 한글 (조사·메타 noun 제외)
// 단독 매치 OK 케이스:
//  - 비한글 경계 (공백·구두점·끝)
//  - 한국어 조사 ("점심에"·"저녁의")
//  - 메타 noun ("점심일정"·"저녁스케줄") — 시간대 + 메타의 띄어쓰기 누락 표현
function isStandaloneTimeword(question: string, kw: string): boolean {
  let idx = 0;
  while ((idx = question.indexOf(kw, idx)) >= 0) {
    // 앞 합성어 가드 — kw 직전 글자가 한글이면 합성어 ("직원점심" 등)
    if (idx > 0 && /[가-힣]/.test(question[idx - 1])) {
      idx += kw.length;
      continue;
    }
    const after = question.slice(idx + kw.length);
    const next = after[0];
    if (!next || !/[가-힣]/.test(next)) return true;
    if (TIME_PARTICLES.some((p) => after.startsWith(p))) return true;
    if (TIME_META_NOUNS.some((m) => after.startsWith(m))) return true;
    idx += kw.length; // 뒤 합성어 — 다음 occurrence 시도
  }
  return false;
}

// "(오전|오후)? X시 (이후|이전)" 명시적 시간 경계 패턴.
// 예: "14시 이후", "오후 6시 이전", "오전 9시 이후"
const TIME_BOUND_RE = /(오전|오후)?\s*(\d{1,2})\s*시\s*(이후|이전)/;

// "(오전|오후)? X시" 정확 시간 패턴 — 분·콜론·간·반 등 부수 표기 없을 때만.
// 예: "12시 일정", "오후 3시 회의 보여줘"
// 매치 안 됨: "12시간" (간), "12시 30분" (분/숫자), "12:30" (콜론), "12시반" (반)
const TIME_AT_HOUR_RE = /(오전|오후)?\s*(\d{1,2})\s*시(?!\s*\d|\s*[:：]|\s*분|간|반)/;

// "(오전|오후)? X시 Y분" / "X:Y" / "X시반" — 분 단위까지 명시된 시각.
// hour 만 추출해 [hour, hour+1) band 로 사용 (분은 무시) — 21:30 startAt 도 band [21,22) 에 들어와 매치됨.
// schedule_delete 다중후보 좁힐 때 사용자가 "21시 30분", "21:30", "9시반" 같이 말해도 시 단위로 매치 가능.
const TIME_AT_HOUR_MINUTE_RE = /(오전|오후)?\s*(\d{1,2})\s*(?:시\s*(?:\d{1,2}\s*분|반)|[:：]\s*\d{1,2})/;

type TimeBandResult =
  | { kind: 'objective'; band: TimeBand }
  | { kind: 'ambiguous'; keyword: string; needsAmpm?: boolean }
  | { kind: 'none' };

// "(오전|오후)? X시" → KST 24h hour 변환.
// 오후 1~11시 → +12 / 오후 12시 → 12 (정오) / 오전 12시 → 0 (자정)
// 오전 1~11시 → 그대로 / 24h 표기 (오전·오후 없이) → 그대로
function toKstHour24(ampm: string | undefined, hour: number): number {
  if (ampm === '오후') return hour < 12 ? hour + 12 : 12;
  if (ampm === '오전') return hour === 12 ? 0 : hour;
  return hour;
}

// 사용자 질의에서 시간대 키워드 검출.
// 우선순위:
//  1) "X시 이후/이전" — 명시적 시간 경계 (가장 구체적)
//  2) "X시" 정확 시간 — 분/콜론/간/반 등 없는 단독 시 표기. [X, X+1) 한 시간대.
//  2.5) "X시 Y분" / "X:Y" / "X시반" — 분 단위 동반 시각. hour 만 추출해 [X, X+1) band 로 사용.
//  3) HAS_SPECIFIC_TIME — 위 2.5 도 못 잡는 모호 시각 (예: "13시 5분 30초") → 시간대 무시
//  4) OBJECTIVE_BANDS — 오전/오후 + 일상 시간대 (새벽/아침/점심/저녁/밤)
//  5) AMBIGUOUS_BANDS — 자정 가로지르는 야식 등 (단일 [start,end) 표현 불가)
function detectTimeBand(question: string): TimeBandResult {
  // 1) 명시적 시간 경계 우선
  const bm = question.match(TIME_BOUND_RE);
  if (bm) {
    const ampm = bm[1] || undefined;
    const hour = parseInt(bm[2], 10);
    const direction = bm[3]; // '이후' | '이전'
    // AM/PM 모호 가드 — bare 1~12 시 + 오전/오후 미명시면 → 후속 질문 (등록 경로와 동일 정책).
    // 13시+ 24h 표기 (13~24) 와 0시 (자정 = 명확) 는 통과.
    // needsAmpm: true 로 마킹 — 채팅 핸들러가 multi-turn (awaiting-input) 처리.
    if (!ampm && hour >= 1 && hour <= 12) {
      return { kind: 'ambiguous', keyword: `${hour}시 ${direction}`, needsAmpm: true };
    }
    const h = Math.max(0, Math.min(24, toKstHour24(ampm, hour)));
    if (direction === '이후') {
      return { kind: 'objective', band: { start: h, end: 24, label: `${h}시 이후` } };
    }
    return { kind: 'objective', band: { start: 0, end: h, label: `${h}시 이전` } };
  }
  // 2) "X시" 정확 시간 — [X, X+1) 한 시간대로 필터
  const hm = question.match(TIME_AT_HOUR_RE);
  if (hm) {
    const ampm = hm[1] || undefined;
    const hour = parseInt(hm[2], 10);
    // AM/PM 모호 가드 — 1) 분기와 동일.
    if (!ampm && hour >= 1 && hour <= 12) {
      return { kind: 'ambiguous', keyword: `${hour}시`, needsAmpm: true };
    }
    const h = Math.max(0, Math.min(23, toKstHour24(ampm, hour)));
    return { kind: 'objective', band: { start: h, end: h + 1, label: `${h}시` } };
  }
  // 2.5) "X시 Y분" / "X:Y" / "X시반" — 분 단위 시각. hour 단위로만 band 추출 (분 무시).
  //      "21시 30분" 입력해도 21:30 startAt schedule 매치 가능.
  const hmm = question.match(TIME_AT_HOUR_MINUTE_RE);
  if (hmm) {
    const ampm = hmm[1] || undefined;
    const hour = parseInt(hmm[2], 10);
    if (!ampm && hour >= 1 && hour <= 12) {
      return { kind: 'ambiguous', keyword: hmm[0].trim(), needsAmpm: true };
    }
    const h = Math.max(0, Math.min(23, toKstHour24(ampm, hour)));
    return { kind: 'objective', band: { start: h, end: h + 1, label: `${h}시` } };
  }
  // 3) 위 2/2.5 도 못 잡는 모호 시각 → 시간대 필터 적용 안 함
  if (HAS_SPECIFIC_TIME.test(question)) return { kind: 'none' };
  // 4) 오전/오후 + 일상 시간대 — 합성어 안에 매몰된 단어("점심약속", "저녁식사")는 제외.
  for (const [kw, band] of Object.entries(OBJECTIVE_BANDS)) {
    if (isStandaloneTimeword(question, kw)) return { kind: 'objective', band };
  }
  // 5) 모호 키워드 — 동일 합성어 가드 적용
  for (const kw of AMBIGUOUS_BANDS) {
    if (isStandaloneTimeword(question, kw)) return { kind: 'ambiguous', keyword: kw };
  }
  return { kind: 'none' };
}

// startAt 의 KST 시(hour) 가 band 의 [start, end) 범위 안인지로 필터.
function filterByTimeBand<T extends { startAt: string }>(
  schedules: T[],
  band: TimeBand | null | undefined
): T[] {
  if (!band) return schedules;
  return schedules.filter((s) => {
    const kstHour = new Date(
      new Date(s.startAt).getTime() + 9 * 60 * 60 * 1000
    ).getUTCHours();
    return kstHour >= band.start && kstHour < band.end;
  });
}

// 백엔드 GET ?view=month 는 캘린더 그리드(6주, 일~토 = 42일) 를 반환 — 사용자가
// "이번달" / "5월" 로 의도한 달력월(1일~말일) 보다 넓다. 사용자 멘탈 모델에 맞춰
// AI 어시스턴트 답변에선 startAt 의 KST 캘린더 month 가 date 의 month 와
// 일치하는 일정만 노출. (캘린더 화면 자체는 그리드 표시 그대로 유지.)
function filterByCalendarMonth<T extends { startAt: string }>(
  schedules: T[],
  date: string,
): T[] {
  const targetYear = parseInt(date.slice(0, 4), 10);
  const targetMonth = parseInt(date.slice(5, 7), 10);
  if (!targetYear || !targetMonth) return schedules;
  return schedules.filter((s) => {
    const kst = new Date(new Date(s.startAt).getTime() + 9 * 60 * 60 * 1000);
    return (
      kst.getUTCFullYear() === targetYear &&
      kst.getUTCMonth() + 1 === targetMonth
    );
  });
}

// 사용자 입력에 시점 단서가 있는지 판정 — runScheduleQuery 의 month 자동 확장 결정용.
// 시점 단서가 없으면 LLM 이 today fallback 으로 view=day 떨어뜨릴 가능성 높음 (환각).
// 사용자가 "회의 수정해줘" 처럼 시점 명시 없이 던지면 의도는 "모든 회의 중 선택" — month 가 합리적.
// 약식 날짜 표기 모두 포함 — 5.1 / 5/1 / 5.1. (월·일) + 22. (일자만, trailing dot) — 한국에서 자주 쓰임.
const HAS_TIMING_SIGNAL_RE =
  /(어제|오늘|내일|모레|글피|\d+\s*월|\d+\s*일|\d+\s*\.\s*\d+|\d+\s*\/\s*\d+|\d{1,2}\s*\.\s|월요일|화요일|수요일|목요일|금요일|토요일|일요일|이번\s*주|다음\s*주|지난\s*주|이번\s*달|다음\s*달|지난\s*달)/;

// schedule_create 통합 묻기 결정용 — 사용자 입력에 시각 단서가 있는지 판정.
// 명시 시각(N시·HH:MM)·AM/PM·일상 시간대(아침/점심/저녁/밤·새벽)·자정/정오 모두 포함.
// 합성어 매몰("점심약속") 도 시간대 의도 단서로 보고 true 처리 — 통합 묻기 회피용 가벼운 휴리스틱.
const HAS_TIME_SIGNAL_RE = /\d+\s*시|\d+\s*[:：]\s*\d+|오전|오후|새벽|아침|점심|저녁|밤|정오|자정|야식/;

// schedule_query 본체 — 자연어 파싱 + DB 조회 + keyword 필터 + 0건이면 month 자동 확장.
//
// 확장 규칙:
//  (a) keyword 가 있고 첫 검색이 day/week 였는데 0건이면 month 로 재조회.
//  (b) view=day 인데 사용자가 시점 단서를 명시하지 않았으면 (LLM today fallback 환각 가능성)
//      결과 건수와 무관하게 month 로 확장 — 의도 ("모든 X 중 선택") 에 더 가까운 결과 제공.
async function runScheduleQuery(opts: {
  question: string;
  teamId: string;
  jwt: string;
  band?: TimeBand | null;
}): Promise<{
  schedules: Schedule[];
  range: {
    view: 'day' | 'week' | 'month';
    date: string;
    keyword: string;
    band?: TimeBand;
    // 명시적 라벨 override — formatSchedules 가 view/date 기반 자동 라벨 대신 이 문자열 사용.
    // 미래 lookahead 처럼 단일 view/date 표현으로 정확히 표현 안 되는 케이스용.
    label?: string;
  };
}> {
  const { question, teamId, jwt, band } = opts;
  const initial = await parseScheduleQuery(question);
  const userGaveTime = HAS_TIMING_SIGNAL_RE.test(question);
  const rangeBand = band ?? undefined;

  // 키워드 OR 시간대(band) + 날짜 단서 없음 → 현재일 이후 6개월 미래 lookahead 누적 매치.
  // 의도: "전체회의 일정 정리해줘" / "점심 일정 수정" 같은 시점 미명시 검색은 사용자가
  // "앞으로 다가올 모든 매치" 를 보고 싶어함. 단일 월(parseScheduleQuery 의 view=month
  // + date=오늘)로 잘려 다음달 일정이 누락되던 한계 해소.
  if (initial.view === 'month' && (initial.keyword || band) && !userGaveTime) {
    const FUTURE_MONTHS = 6;
    const baseY = parseInt(initial.date.slice(0, 4), 10);
    const baseM = parseInt(initial.date.slice(5, 7), 10);
    // 오늘(KST 자정) 이전 startAt 컷 — UTC 기준 cutoff 시각 산출.
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayKstMidnightUtcMs =
      Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate())
      - 9 * 60 * 60 * 1000;
    const seenIds = new Set<string>();
    const collected: Schedule[] = [];
    for (let i = 0; i < FUTURE_MONTHS; i++) {
      const monthAnchor = new Date(Date.UTC(baseY, baseM - 1 + i, 1))
        .toISOString().slice(0, 10);
      const monthSchedules = await getSchedules({
        teamId, jwt, view: 'month', date: monthAnchor,
      });
      const bounded = filterByCalendarMonth(monthSchedules, monthAnchor);
      for (const s of filterByKeyword(bounded, initial.keyword)) {
        if (seenIds.has(s.id)) continue;
        if (new Date(s.startAt).getTime() < todayKstMidnightUtcMs) continue;
        seenIds.add(s.id);
        collected.push(s);
      }
    }
    collected.sort((a, b) =>
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const filtered = filterByTimeBand(collected, band);
    // 라벨: "YYYY년 M월 D일(오늘) 이후" — 6개월 누적 검색 범위를 명시.
    const futureLabel = `${nowKst.getUTCFullYear()}년 ${nowKst.getUTCMonth() + 1}월 ${nowKst.getUTCDate()}일(오늘) 이후`;
    return {
      schedules: filtered,
      range: { ...initial, band: rangeBand, label: futureLabel },
    };
  }

  const allInitial = await getSchedules({
    teamId, jwt, view: initial.view, date: initial.date,
  });
  // view=month 는 백엔드가 6주 그리드를 반환하므로 달력월(1일~말일) 로 추가 좁힘.
  const allInitialBounded =
    initial.view === 'month'
      ? filterByCalendarMonth(allInitial, initial.date)
      : allInitial;
  const filteredInitial = filterByTimeBand(
    filterByKeyword(allInitialBounded, initial.keyword),
    band,
  );
  // view=day 인데 시점 단서 없음 → month 로 확장 (의도: "회의 수정해줘" → 모든 회의 후보).
  // (위 미래 lookahead 분기에서 처리 안 된 케이스만 여기로 옴 — 예: LLM 이 view=day 환각.)
  const shouldExpandForMissingTime = initial.view === 'day' && !userGaveTime;
  if (
    (filteredInitial.length || !initial.keyword || initial.view === 'month') &&
    !shouldExpandForMissingTime
  ) {
    return { schedules: filteredInitial, range: { ...initial, band: rangeBand } };
  }
  // keyword 매치 0건 + 좁은 범위 OR 시점 미명시 + view=day → month 로 확장 재조회.
  const expanded = await getSchedules({
    teamId, jwt, view: 'month', date: initial.date,
  });
  const expandedBounded = filterByCalendarMonth(expanded, initial.date);
  const filteredExpanded = filterByTimeBand(
    filterByKeyword(expandedBounded, initial.keyword),
    band,
  );
  return {
    schedules: filteredExpanded,
    range: { view: 'month', date: initial.date, keyword: initial.keyword, band: rangeBand },
  };
}

// schedule 인자 파싱 — RAG 서버의 /parse-schedule-args.
// 반환:
//  - ok:true → 인자 완성 → confirm 카드
//  - ok:false + needs → 정보 부족 → 후속 질문 hint
//  - ok:false + error → 파싱 실패 → 일반 에러
async function parseScheduleArgs(question: string): Promise<
  | { ok: true; args: { title: string; startAt: string; endAt: string | null; description?: string; color?: string } }
  | { ok: false; needs: string; hint: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${RAG_SERVER_URL}/parse-schedule-args`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, nowIso: new Date().toISOString() }),
    });
    const data = await res.json();
    if (data?.ok && data.args) return { ok: true, args: data.args };
    if (data?.ok === false && typeof data.needs === 'string') {
      return { ok: false, needs: data.needs, hint: data.hint || '더 자세히 알려주세요.' };
    }
    return { ok: false, error: data?.error || '인자 파싱 실패' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// 일정 목록을 자연어 답변 텍스트로 포맷. LLM 호출 0회 — 사용자에게 정확·즉시.
// range 가 주어지면 답변 머리에 "(2026-04-22) 하루의" 등 조회 범위 명시.
function formatSchedules(
  schedules: Schedule[],
  opts: {
    teamName?: string;
    range?: {
      view: 'day' | 'week' | 'month';
      date: string;
      keyword?: string;
      band?: TimeBand;
      // 명시적 라벨 — view/date 기반 자동 라벨 대신 이 문자열 그대로 표시.
      label?: string;
    };
  }
): string {
  const teamPrefix = opts.teamName ? `${opts.teamName} 팀의 ` : '';
  const rangeLabel = (() => {
    if (!opts.range) return '';
    const r = opts.range;
    if (r.label) return `${r.label} `;
    if (r.view === 'day') return `${r.date} `;
    if (r.view === 'week') return `${r.date} 주 `;
    if (r.view === 'month') return `${r.date.slice(0, 7)} `;
    return '';
  })();
  const bandLabel = opts.range?.band?.label ? `${opts.range.band.label} ` : '';
  const keywordLabel = opts.range?.keyword ? `'${opts.range.keyword}' ` : '';
  if (!schedules.length) {
    return `${teamPrefix}${rangeLabel}${bandLabel}${keywordLabel}일정이 없어요.`;
  }
  const lines = schedules.map((s) => {
    const start = new Date(s.startAt);
    const startStr = start.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    // endAt null → 시작시각만 표시 (선택 입력화 후 4군데 일관 포맷).
    if (!s.endAt) {
      return `• ${startStr}  ${s.title}${s.description ? ` — ${s.description}` : ''}`;
    }
    const end = new Date(s.endAt);
    const endStr = end.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `• ${startStr} ~ ${endStr}  ${s.title}${s.description ? ` — ${s.description}` : ''}`;
  });
  return `${teamPrefix}${rangeLabel}${bandLabel}${keywordLabel}일정 ${schedules.length}건:\n${lines.join('\n')}`;
}

// 거절 안내 메시지.
function blockedMessage(subreason?: string): string {
  // schedule_modify subreason 은 현재 미사용 (취소 = 삭제 로 통합) — 안전망으로 유지.
  if (subreason === 'schedule_modify') {
    return '찰떡이는 **일정 조회·등록·삭제·수정** 만 도와드릴 수 있어요. 🙏';
  }
  if (subreason === 'other_domain') {
    return '찰떡이는 **일정 조회·등록·삭제·수정** 만 도와드릴 수 있어요. 프로젝트·채팅·공지·포스트잇 같은 작업은 화면에서 직접 처리해 주세요. 🙏';
  }
  return '찰떡이는 **일정 조회·등록·삭제·수정** 만 도와드릴 수 있어요. 직접 처리해 주세요. 🙏';
}

// schedule_delete — 후보 일정을 사람이 알아볼 수 있는 한 줄로 포맷.
// formatSchedules 와 비슷하지만 confirm 카드 안에 넣을 단일 항목용.
function formatScheduleLine(s: Schedule): string {
  const start = new Date(s.startAt);
  const startStr = start.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  // endAt null → 시작시각만 표시.
  if (!s.endAt) {
    return `${startStr}  ${s.title}${s.description ? ` — ${s.description}` : ''}`;
  }
  const end = new Date(s.endAt);
  const endStr = end.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${startStr} ~ ${endStr}  ${s.title}${s.description ? ` — ${s.description}` : ''}`;
}

// schedule_update multi-step state — 식별 → 새 일시 → 새 제목 → confirm.
// stateless 한 chat route 가 step 간 정보를 carry 하기 위해 클라이언트가 매 turn 마다
// 이 객체를 request body 에 동봉해 보냄.
type UpdateState = {
  needs: 'new-datetime' | 'new-title';
  targetScheduleId: string;
  targetTitle: string;
  targetStartAt: string;
  // 종료시각은 선택 입력 — null 이면 시작시각만 정해진 일정.
  targetEndAt: string | null;
  newStartAt?: string;
  newEndAt?: string | null;
  newTitle?: string;
};

// "그대로" 류 키워드 — 사용자가 해당 필드를 변경하지 않겠다는 의사 표시.
// 정중한 동사 어미("그대로 해줘", "유지해줘", "기존대로 둬요") 까지 허용.
// 단, 새 제목으로 오해 가능한 자유 텍스트(예: "그대로 새 회의")는 매치 안 됨 — 동사 어미 화이트리스트로 제한.
const KEEP_AS_IS_RE = /^(그대로|기존(?:대로)?|유지|동일하?게?|그냥|안\s*바꿔|안\s*바꿈|변경\s*없음)(\s*(해|둬|돼|놔|두|놓|가|유지|부탁|놓아|있)[가-힣\s]{0,5})?\s*[.!?]?\s*$/;

// schedule_update multi-step 의 new-datetime 단계 전용 deterministic 파서.
// 작은 LLM(e4b) 이 시각/날짜를 환각하는 케이스 회피 — 정형 입력은 LLM 우회 후 직접 ISO 산출.
// 처리: "5월 9일 20시", "9일 오후 8시", "내일 14시", "오늘 18시 30분" 등 (날짜+시각 풀세트).
// 미처리(null 반환 → LLM fallback): "다음주 수요일 2시", "오후 3시"(시각만), 비정형 표현.
function tryParseDirectDatetime(
  question: string,
  targetStartAt: string,
  targetEndAt: string | null,
): { startAt: string; endAt: string | null } | null {
  // 요일/주 키워드는 deterministic 미지원 — LLM 매핑 표 위임.
  if (/(이번|다음|지난)\s*주|월요일|화요일|수요일|목요일|금요일|토요일|일요일/.test(question)) {
    return null;
  }

  // 1) 시각 추출
  let hour: number | null = null;
  let minute = 0;
  if (/정오/.test(question)) hour = 12;
  else if (/자정/.test(question)) hour = 0;
  else {
    // 한국어 "반" = 30분 처리 — m[3]="N분", m[4]="반" 분리 매치.
    const m = question.match(/(오전|오후|새벽)?\s*(\d{1,2})\s*시(?:\s*(?:(\d{1,2})\s*분|(반)))?/);
    if (!m) return null;
    let h = parseInt(m[2], 10);
    if (Number.isNaN(h) || h < 0 || h > 23) return null;
    const ampm = m[1];
    if (ampm === '오후' && h >= 1 && h <= 11) h += 12;
    else if ((ampm === '오전' || ampm === '새벽') && h === 12) h = 0;
    hour = h;
    if (m[4] === '반') minute = 30;
    else if (m[3]) minute = parseInt(m[3], 10);
    else minute = 0;
    if (minute < 0 || minute > 59) return null;
  }

  // 2) 날짜 단서 — 풀세트(날짜+시각) 만 deterministic 처리. 시각만이면 null → LLM 위임.
  const REL_OFFSETS: Record<string, number> = { 어제: -1, 오늘: 0, 내일: 1, 모레: 2, 글피: 3 };
  const relKey = (Object.keys(REL_OFFSETS) as Array<keyof typeof REL_OFFSETS>).find((k) =>
    question.includes(k),
  );
  const monthDayMatch = question.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  const dayOnlyMatch =
    !monthDayMatch && !relKey ? question.match(/(?<!\d)(\d{1,2})\s*일(?!\d)/) : null;
  if (!relKey && !monthDayMatch && !dayOnlyMatch) return null;

  // 3) KST 좌표 결정
  const nowKst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const baseY = nowKst.getUTCFullYear();
  const baseM = nowKst.getUTCMonth(); // 0-based
  const baseD = nowKst.getUTCDate();
  let year: number;
  let month: number; // 1-based
  let day: number;
  if (relKey) {
    const t = new Date(Date.UTC(baseY, baseM, baseD + REL_OFFSETS[relKey]));
    year = t.getUTCFullYear();
    month = t.getUTCMonth() + 1;
    day = t.getUTCDate();
  } else if (monthDayMatch) {
    month = parseInt(monthDayMatch[1], 10);
    day = parseInt(monthDayMatch[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    year = baseY;
    const cand = new Date(Date.UTC(year, month - 1, day));
    const today = new Date(Date.UTC(baseY, baseM, baseD));
    if (cand.getTime() < today.getTime()) year++;
  } else if (dayOnlyMatch) {
    const dnum = parseInt(dayOnlyMatch[1], 10);
    if (dnum < 1 || dnum > 31) return null;
    let cy = baseY;
    let cm = baseM;
    const todayMs = new Date(Date.UTC(baseY, baseM, baseD)).getTime();
    let candMs = new Date(Date.UTC(cy, cm, dnum)).getTime();
    if (Number.isNaN(candMs) || candMs < todayMs) {
      cm += 1;
      if (cm > 11) {
        cm = 0;
        cy += 1;
      }
      candMs = new Date(Date.UTC(cy, cm, dnum)).getTime();
    }
    const cd = new Date(candMs);
    if (cd.getUTCDate() !== dnum) return null; // 4월 31일 같은 케이스
    year = cd.getUTCFullYear();
    month = cd.getUTCMonth() + 1;
    day = cd.getUTCDate();
  } else {
    // unreachable — 위 가드에서 제거됨.
    return null;
  }

  // 4) 실제 달력 검증 (2월 31일 자동 보정 막기)
  const checkUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    checkUtc.getUTCFullYear() !== year ||
    checkUtc.getUTCMonth() !== month - 1 ||
    checkUtc.getUTCDate() !== day
  ) {
    return null;
  }

  // 5) KST → UTC: Date.UTC 의 epoch 는 그대로 UTC 로 해석되므로 -9h 보정해야 KST 의도와 동일.
  const startMs = Date.UTC(year, month - 1, day, hour!, minute, 0) - 9 * 60 * 60 * 1000;
  // 기존 일정에 endAt 이 있을 때만 duration 보존, 없으면 새 endAt 도 null.
  if (!targetEndAt) {
    return { startAt: new Date(startMs).toISOString(), endAt: null };
  }
  const durationMs = new Date(targetEndAt).getTime() - new Date(targetStartAt).getTime();
  return {
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + durationMs).toISOString(),
  };
}

// 새 제목 추출 trailing 패턴 — "X (으)로/라고 [동사] [어미]" 에서 X 만 남김.
// 사용자가 "저녁고객미팅으로 해줘" / "전체 회의로 바꿔줘" 라 답하면 X 만 title 로 사용.
// 동사·어미 모두 optional — "X으로" / "X로" / "X 라고" 만 입력해도 같은 효과.
// false positive 방지: "(으)로/라고" 가 반드시 있어야 strip — title 끝에 동사형이 있어도 보존.
const NEW_TITLE_TRAILING_RE =
  /\s*(?:으로|로|라고)\s*(?:변경|바꿔|수정|이동|넣어|입력|부탁(?:드려)?)?\s*(?:해줘|해|줘)?\s*\.?\s*$/;
function extractNewTitle(input: string): string {
  return input.replace(NEW_TITLE_TRAILING_RE, '').trim();
}

// 첫 발화 벌크 의도 — schedule_update / schedule_delete 의 식별 단계 진입 직후 안내.
// frontend 의 BULK_DELETE_INTENT_RE 와 동일 패턴 (서버에서도 한 번 더 가드).
const BULK_INTENT_RE = /(전체|모두|전부|모든|다\s*(?:삭제|지워|지운|제거|수정|변경|바꿔))/;

// schedule_update 비지원 필드 — multi-step 흐름은 시각·제목만 변경 가능.
// 색깔·설명·메모 등은 캘린더 화면에서 직접 처리하도록 안내.
const UNSUPPORTED_UPDATE_FIELD_RE = /(색깔|색상|색\b|설명|메모)/;

// schedule_update 진행 중인지 판정 (request body 의 updateState 기반).
function parseUpdateState(raw: unknown): UpdateState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const needs = r.needs;
  if (needs !== 'new-datetime' && needs !== 'new-title') return null;
  if (
    typeof r.targetScheduleId !== 'string' ||
    typeof r.targetTitle !== 'string' ||
    typeof r.targetStartAt !== 'string' ||
    typeof r.targetEndAt !== 'string'
  ) return null;
  return {
    needs,
    targetScheduleId: r.targetScheduleId,
    targetTitle: r.targetTitle,
    targetStartAt: r.targetStartAt,
    targetEndAt: r.targetEndAt,
    newStartAt: typeof r.newStartAt === 'string' ? r.newStartAt : undefined,
    newEndAt: typeof r.newEndAt === 'string' ? r.newEndAt : undefined,
    newTitle: typeof r.newTitle === 'string' ? r.newTitle : undefined,
  };
}

// 변경 전/후 비교 텍스트 — confirm 카드에 들어갈 요약.
// 시각은 "M. D. HH:MM ~ HH:MM" 한 줄로 묶어 표시 (formatScheduleLine 과 동일 포맷).
function formatUpdateConfirm(state: {
  targetTitle: string;
  targetStartAt: string;
  targetEndAt: string | null;
  newTitle?: string;
  newStartAt?: string;
  newEndAt?: string | null;
}): string {
  const fmtRange = (startIso: string, endIso: string | null): string => {
    const start = new Date(startIso);
    const startStr = start.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    if (!endIso) return startStr;
    const end = new Date(endIso);
    const endStr = end.toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    return `${startStr} ~ ${endStr}`;
  };

  const lines: string[] = ['다음과 같이 수정할까요?', ''];
  const newTitle = state.newTitle ?? state.targetTitle;
  if (newTitle !== state.targetTitle) {
    lines.push(`• 제목: ${state.targetTitle} => ${newTitle}`);
  } else {
    lines.push(`• 제목: ${state.targetTitle} (그대로)`);
  }

  const newStartAt = state.newStartAt ?? state.targetStartAt;
  const newEndAt = state.newEndAt ?? state.targetEndAt;
  const oldRange = fmtRange(state.targetStartAt, state.targetEndAt);
  const newRange = fmtRange(newStartAt, newEndAt);
  if (oldRange !== newRange) {
    lines.push(`• ${oldRange} => ${newRange}`);
  } else {
    lines.push(`• ${oldRange} (그대로)`);
  }
  return lines.join('\n');
}

// RAG 가드레일이 "참고 자료에 없어요" 류로 거절했는지 판정.
// 거절형이면 Open WebUI(웹검색) 으로 fallback 한다.
//
// 거절 시그널은 보통 다음 중 하나로 나타난다:
//  (a) "참고 자료" 라는 메타 표현 — 정상 사용법 답변에는 등장하지 않음 (강한 시그널)
//  (b) "찰떡" 자기소개로 마감 — 가드레일이 거절 시 자기소개로 끝내도록 유도
//  (c) "현재 안내되어 있지 않아요" / "이용과 관련하여 궁금한 점" 류 표준 거절 문구
const REFUSAL_PATTERNS = [
  /참고\s*자료/,                          // (a) 강한 시그널
  /AI\s*비서\s*["“”']?찰떡/,              // (b) 자기소개 마감
  /현재\s*안내되어\s*있지\s*않/,          // (c)
  /TEAM\s*WORKS\s*이용과\s*관련/i,        // (c) 표준 거절 후미
  /TEAM\s*WORKS\s*사용법\s*외/i,
  /제공된\s*(참고\s*)?자료에는?[^]{0,30}않/,
  /포함되어\s*있지\s*않아/,
  /관련\s*(정보|내용)을?\s*(찾을\s*수\s*없|포함하고\s*있지\s*않)/,
  /잘\s*모르겠어요/,
  // 운영 중 발견된 거절 케이스 보강
  /안내되어\s*있지\s*않/,                  // "현재" 없이도 매칭 ("X 기능은 안내되어 있지 않습니다")
  /안내해\s*드릴\s*수\s*없/,
  /저는\s*TEAM\s*WORKS\s*의?\s*AI\s*비서/, // 찰떡 단어 없는 자기소개 마감
  /안내\s*모드[\s\S]{0,200}실행\s*모드/,    // 두 모드 설명으로 마감 = 거절형
];
function isRefusal(answer: string): boolean {
  if (!answer || answer.length < 5) return true; // 빈 응답도 거절로 간주
  return REFUSAL_PATTERNS.some((re) => re.test(answer));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return NextResponse.json({ error: '질문을 입력해 주세요.' }, { status: 400 });
    }

    const teamId: string = typeof body?.teamId === 'string' ? body.teamId : '';
    const teamName: string = typeof body?.teamName === 'string' ? body.teamName : '';
    const auth = request.headers.get('authorization') || '';
    const jwt = /^Bearer\s+(.+)$/i.exec(auth)?.[1] || '';

    // schedule_update multi-step state — 클라이언트가 매 turn 마다 carry 하는 conversation 상태.
    // 이 객체가 있으면 classify 우회하고 schedule_update 분기로 직진 (사용자 답변이
    // "내일 오후 3시" / "그대로" 같이 분류 키워드 미포함이라도 정확히 라우팅).
    const updateState = parseUpdateState(body?.updateState);
    const cls: Classification = updateState
      ? { intent: 'schedule_update', reason: 'multi-step' }
      : await classify(question);
    const topK = Number.isFinite(body?.topK) ? body.topK : undefined;
    const isStream = body?.stream === true;
    // RAG 서버가 런타임에 해석한 채팅 모델명 — UI 푸터 표시용. 미응답 시 undefined.
    const ragModel = await fetchRagModel();
    // 답변 출처에 따라 다른 모델이 쓰임. RAG/일정·일반 경로 모두 Ollama 모델
    // (일반 경로는 Open WebUI 가 우회 호출). 메타용 모델명도 자동 해석.
    const ragMeta = ragModel ? { model: ragModel } : {};
    const webModel = await resolveOpenWebUiModel().catch(() => undefined);
    const webMeta = webModel ? { model: webModel } : {};

    // schedule_* / blocked-other_domain(create 시) 는 로그인 + teamId 필수.
    const needsAuth =
      cls.intent === 'schedule_query' ||
      cls.intent === 'schedule_create' ||
      cls.intent === 'schedule_delete' ||
      cls.intent === 'schedule_update';
    if (needsAuth && !jwt) {
      return NextResponse.json(
        { error: '일정 조회·등록은 로그인 후 이용해 주세요.' },
        { status: 401 }
      );
    }
    if (needsAuth && !teamId) {
      return NextResponse.json(
        { error: '활성 팀이 없습니다. 팀을 먼저 선택해 주세요.' },
        { status: 400 }
      );
    }

    // === Streaming response (SSE) ===
    if (isStream) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send: SendFn = (obj) => {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            switch (cls.intent) {
              case 'usage': {
                send({ type: 'meta', source: 'rag', classification: cls, ...ragMeta });
                await streamRag(question, topK, send);
                break;
              }
              case 'general': {
                send({
                  type: 'meta',
                  source: 'web',
                  classification: { ...cls, fallback: 'general-keyword-direct' },
                  ...webMeta,
                });
                await streamOpenWebUi(question, send);
                const sources = await searxngQuery(question);
                if (sources.length) send({ type: 'sources', sources });
                break;
              }
              case 'schedule_query': {
                send({ type: 'meta', source: 'schedule', classification: cls, ...ragMeta });
                const tb = detectTimeBand(question);
                if (tb.kind === 'ambiguous') {
                  if (tb.needsAmpm) {
                    // bare 1~12시 — AM/PM 보충받아 재요청 (등록 경로의 needs:time 패턴과 동일).
                    send({
                      type: 'token',
                      text: `오전/오후 어느 쪽일까요? (예: '오후 ${tb.keyword}')`,
                    });
                    send({
                      type: 'awaiting-input',
                      needs: 'time',
                      previousQuestion: question,
                    });
                  } else {
                    // 모호 키워드 (자정 가로지르는 야식 등) — 안내만.
                    send({
                      type: 'token',
                      text: `'${tb.keyword}'의 기준 시각이 모호해요. '오후 6시 이후 일정' 처럼 구체적으로 알려주세요.`,
                    });
                  }
                  break;
                }
                const band = tb.kind === 'objective' ? tb.band : null;
                const { schedules, range } = await runScheduleQuery({ question, teamId, jwt, band });
                send({
                  type: 'sources',
                  sources: schedules.map((s) => ({
                    title: s.title,
                    startAt: s.startAt,
                    endAt: s.endAt,
                  })) as WebSource[],
                });
                send({ type: 'token', text: formatSchedules(schedules, { teamName, range }) });
                break;
              }
              case 'schedule_create': {
                send({ type: 'meta', source: 'schedule', classification: cls, ...ragMeta });
                // bare 1~12시 모호 가드 — parseScheduleArgs(LLM) 호출 전에 AM/PM 보충 받음.
                // (query/delete/update 와 동일 정책. RAG 서버 LLM 의 임의 AM/PM 추정 환각 방지.)
                const tbCreate = detectTimeBand(question);
                if (tbCreate.kind === 'ambiguous' && tbCreate.needsAmpm) {
                  send({
                    type: 'token',
                    text: `오전/오후 어느 쪽일까요? (예: '오후 ${tbCreate.keyword}')`,
                  });
                  send({
                    type: 'awaiting-input',
                    needs: 'time',
                    previousQuestion: question,
                  });
                  break;
                }
                // 시간·일자 시그널 둘 다 없는 매우 모호한 요청 ("일정등록 해줘") 사전 가드.
                // RAG parseScheduleArgs 가 임의 제목('일정') + 현재시각 환각으로 채워 ok 응답을
                // 내놓는 케이스 차단. 일시부터 단계적으로 묻기 시작 (update 와 동일 흐름).
                if (!HAS_TIMING_SIGNAL_RE.test(question) && !HAS_TIME_SIGNAL_RE.test(question)) {
                  send({
                    type: 'token',
                    text: `일시는 언제로 할까요? (예: '내일 오후 3시')`,
                  });
                  send({
                    type: 'awaiting-input',
                    needs: 'datetime',
                    previousQuestion: question,
                  });
                  break;
                }
                const parsed = await parseScheduleArgs(question);
                if (parsed.ok) {
                  // 사후 제목 가드 — RAG LLM 이 "일정등록 해줘 내일 오후 2시" 같은 입력에서
                  // "일정등록"을 제목으로 환각 추출(title="일정") 하는 케이스 차단.
                  // title 이 generic 키워드 ('일정'/'회의'/'미팅'/'약속'/'스케줄' 단독) 인데
                  // 사용자 question 에 명시적 일정 명사가 없으면 → needs:'title' 로 재요청.
                  const titleTrimmed = parsed.args.title.trim();
                  // generic 단독("일정") + 동사 결합형("일정 등록", "회의 잡아줘", "스케줄 등록해줘") 모두 매칭.
                  const TITLE_GENERIC_RE =
                    /^(일정|회의|미팅|약속|스케줄|이벤트)\s*(등록|잡기|잡아|만들기|만들어|생성|추가|예약)?\s*(해줘|해|하기)?$/;
                  const EXPLICIT_TITLE_NOUN_RE =
                    /(회의|미팅|약속|점심|저녁|아침|야식|면접|세미나|발표|워크샵|워크숍|교육|상담|리뷰|보고|회식|모임|행사|런칭|런치|디너|컨퍼런스|간담회|MT|티타임)/;
                  if (
                    TITLE_GENERIC_RE.test(titleTrimmed) &&
                    !EXPLICIT_TITLE_NOUN_RE.test(question)
                  ) {
                    send({
                      type: 'token',
                      text: `어떤 일정인지 제목을 알려주세요. (예: '주간 회의')`,
                    });
                    send({
                      type: 'awaiting-input',
                      needs: 'title',
                      previousQuestion: question,
                    });
                    break;
                  }
                  // confirm 카드 — page.tsx 가 pendingAction 으로 처리.
                  send({
                    type: 'pending-action',
                    pendingAction: {
                      tool: 'createSchedule',
                      args: { ...parsed.args, teamId },
                    },
                    preview: parsed.args,
                    text: `다음 내용으로 일정 등록할까요?\n\n• 제목: ${parsed.args.title}\n• 시작: ${new Date(parsed.args.startAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}${parsed.args.endAt ? `\n• 종료: ${new Date(parsed.args.endAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : ''}${parsed.args.description ? `\n• 설명: ${parsed.args.description}` : ''}`,
                  });
                  break;
                }
                if ('needs' in parsed) {
                  // 다중 턴 — 정보 부족. needs 가 'date'/'time' 이면 사용자 입력 신호 검사 후
                  // 둘 다 빠졌는지(통합) / 하나만 빠졌는지(개별) 판정해 hint 와 needs 보정.
                  // RAG LLM 은 검사 순서상 항상 'date' 를 우선 반환 → 그대로 두면 "5월 1일 회의 등록"
                  // (시각 누락 케이스) 와 "회의 등록" (둘 다 누락) 케이스가 같은 문구로 응답되어 UX 빈약.
                  if (parsed.needs === 'date' || parsed.needs === 'time') {
                    const hasDate = HAS_TIMING_SIGNAL_RE.test(question);
                    const hasTime = HAS_TIME_SIGNAL_RE.test(question);
                    if (!hasDate && !hasTime) {
                      send({
                        type: 'token',
                        text: `일시는 언제로 할까요? (예: '내일 오후 3시')`,
                      });
                      send({
                        type: 'awaiting-input',
                        needs: 'datetime',
                        previousQuestion: question,
                      });
                      break;
                    }
                    if (!hasDate) {
                      send({
                        type: 'token',
                        text: `일자는 언제로 할까요? (예: '내일' 또는 '5월 15일')`,
                      });
                      send({
                        type: 'awaiting-input',
                        needs: 'date',
                        previousQuestion: question,
                      });
                      break;
                    }
                    if (!hasTime) {
                      send({
                        type: 'token',
                        text: `시간은 언제로 할까요? (예: '오후 3시')`,
                      });
                      send({
                        type: 'awaiting-input',
                        needs: 'time',
                        previousQuestion: question,
                      });
                      break;
                    }
                    // 둘 다 있는데 LLM 이 needs 떨어뜨린 케이스 (드묾) — RAG hint 그대로.
                  }
                  // needs='title' 또는 위 가드 fall-through — RAG hint 그대로 사용.
                  send({ type: 'token', text: parsed.hint });
                  send({
                    type: 'awaiting-input',
                    needs: parsed.needs,
                    previousQuestion: question,
                  });
                  break;
                }
                if ('error' in parsed) {
                  // 시스템 오류 (Ollama 미연결, JSON 파싱 실패 등) — 사용자 입력은 정상.
                  // 원인을 그대로 노출해 운영자/사용자가 즉시 진단 가능.
                  send({
                    type: 'token',
                    text: `AI 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.\n(원인: ${parsed.error})`,
                  });
                  break;
                }
                send({
                  type: 'token',
                  text: `좀 더 구체적으로 말씀해 주시겠어요?\n(예: "내일 오후 3시 주간 회의 등록해줘")`,
                });
                break;
              }
              case 'schedule_delete': {
                send({ type: 'meta', source: 'schedule', classification: cls, ...ragMeta });
                // 벌크 가드 — 첫 발화에 "전체/모두/다 삭제" 류 → 후보는 보여주되 안내 동시 발송.
                const bulkDelete = BULK_INTENT_RE.test(question);
                const tb = detectTimeBand(question);
                if (tb.kind === 'ambiguous') {
                  if (tb.needsAmpm) {
                    send({
                      type: 'token',
                      text: `오전/오후 어느 쪽일까요? (예: '오후 ${tb.keyword}')`,
                    });
                    send({
                      type: 'awaiting-input',
                      needs: 'time',
                      previousQuestion: question,
                    });
                  } else {
                    // 자정 가로지르는 야식 등 — 안내만 (schedule_query 와 동일).
                    send({
                      type: 'token',
                      text: `'${tb.keyword}'의 기준 시각이 모호해요. '오후 6시 이후 일정' 처럼 구체적으로 알려주세요.`,
                    });
                  }
                  break;
                }
                const band = tb.kind === 'objective' ? tb.band : null;
                const { schedules, range } = await runScheduleQuery({ question, teamId, jwt, band });
                if (schedules.length === 0) {
                  send({
                    type: 'token',
                    text: `${formatSchedules(schedules, { teamName, range })}\n삭제할 일정을 찾지 못했어요. 시점·제목을 더 구체적으로 알려주세요.`,
                  });
                  break;
                }
                if (schedules.length > 1) {
                  send({
                    type: 'sources',
                    sources: schedules.map((s) => ({
                      title: s.title,
                      startAt: s.startAt,
                      endAt: s.endAt,
                    })) as WebSource[],
                  });
                  const bulkNote = bulkDelete
                    ? '\n(한 번에 하나의 일정만 삭제할 수 있어요.) '
                    : '';
                  send({
                    type: 'token',
                    text: `${formatSchedules(schedules, { teamName, range })}\n어떤 일정을 삭제할까요? 제목이나 시각을 더 구체적으로 알려주세요.${bulkNote}`,
                  });
                  send({
                    type: 'awaiting-input',
                    needs: 'title',
                    previousQuestion: question,
                  });
                  break;
                }
                // 단일 매치 — confirm 카드
                const s = schedules[0];
                send({
                  type: 'pending-action',
                  pendingAction: {
                    tool: 'deleteSchedule',
                    args: { teamId, scheduleId: s.id },
                  },
                  preview: { id: s.id, title: s.title, startAt: s.startAt, endAt: s.endAt },
                  text: `다음 일정을 삭제할까요?\n\n• ${formatScheduleLine(s)}`,
                });
                break;
              }
              case 'schedule_update': {
                send({ type: 'meta', source: 'schedule', classification: cls, ...ragMeta });

                // === 단계 2: new-datetime — 사용자가 새 일시 답변 ===
                if (updateState && updateState.needs === 'new-datetime') {
                  let newStartAt: string;
                  let newEndAt: string | null;
                  if (KEEP_AS_IS_RE.test(question)) {
                    newStartAt = updateState.targetStartAt;
                    newEndAt = updateState.targetEndAt;
                  } else {
                    // bare 1~12시 모호 가드 — tryParseDirectDatetime 이 ampm 없는 시각을
                    // 그대로 새벽으로 해석하는 환각 차단. updateState 동봉해 다음 턴에 같은
                    // new-datetime 단계로 재진입.
                    const tbUpd = detectTimeBand(question);
                    if (tbUpd.kind === 'ambiguous' && tbUpd.needsAmpm) {
                      send({
                        type: 'token',
                        text: `오전/오후 어느 쪽일까요? (예: '오후 ${tbUpd.keyword}')`,
                      });
                      send({
                        type: 'awaiting-input',
                        needs: 'time',
                        previousQuestion: question,
                        updateState,
                      });
                      break;
                    }
                    // 1차: deterministic 파서 — 정형 datetime 입력 (날짜+시각 풀세트) 안정 처리.
                    // 작은 LLM 환각 회피용. 매치 안 되면 null → LLM fallback.
                    const direct = tryParseDirectDatetime(
                      question,
                      updateState.targetStartAt,
                      updateState.targetEndAt,
                    );
                    if (direct) {
                      // 과거 시각 검증 (RAG 의 동일 로직과 일치).
                      const startMs = new Date(direct.startAt).getTime();
                      if (startMs < Date.now() - 60_000) {
                        const kstStart = new Date(startMs + 9 * 60 * 60 * 1000);
                        const kstStr = kstStart.toISOString().slice(0, 16).replace('T', ' ');
                        send({
                          type: 'token',
                          text: `${kstStr} 은 이미 지난 시각이에요. 미래 날짜·시각으로 다시 알려주세요.`,
                        });
                        send({
                          type: 'awaiting-input',
                          needs: 'date',
                          previousQuestion: question,
                          updateState,
                        });
                        break;
                      }
                      newStartAt = direct.startAt;
                      newEndAt = direct.endAt;
                    } else {
                      // 2차: LLM fallback — 사용자 답변에 날짜 단서가 없으면 target 의 날짜를 자동 prefix —
                      // 사용자가 시각만 ("오전 10시") 답해도 parseScheduleArgs 가 needs:'date' 로
                      // 떨어지지 않게 (수정 의도는 보통 동일 일정의 시각만 바꾸는 케이스가 많음).
                      let augmented = question;
                      if (!HAS_TIMING_SIGNAL_RE.test(question)) {
                        const tgtKst = new Date(
                          new Date(updateState.targetStartAt).getTime() + 9 * 60 * 60 * 1000,
                        );
                        const y = tgtKst.getUTCFullYear();
                        const m = tgtKst.getUTCMonth() + 1;
                        const d = tgtKst.getUTCDate();
                        augmented = `${y}년 ${m}월 ${d}일 ${question}`;
                      }
                      // parseScheduleArgs 는 title 도 요구하므로 dummy 추가해서 시각만 추출.
                      const parsed = await parseScheduleArgs(`${augmented} 회의`);
                      if (parsed.ok) {
                        newStartAt = parsed.args.startAt;
                        newEndAt = parsed.args.endAt;
                      } else if ('needs' in parsed) {
                        // parseScheduleArgs 의 needs (time/date) 를 그대로 emit — frontend 의
                        // rebuildFollowUpQuestion(needs) 로직이 보충("오후") 을 직전 입력
                        // ("다음주 수요일 2시") 과 combine 해 "다음주 수요일 오후 2시" 로 만들고
                        // updateState 동봉해 다시 new-datetime 단계로 진입.
                        send({ type: 'token', text: parsed.hint });
                        send({
                          type: 'awaiting-input',
                          needs: parsed.needs,
                          previousQuestion: question,
                          updateState,
                        });
                        break;
                      } else {
                        send({
                          type: 'token',
                          text: `AI 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.\n(원인: ${(parsed as { error: string }).error})`,
                        });
                        break;
                      }
                    }
                  }
                  // 다음 단계로 진행 — 새 제목 묻기.
                  const nextState: UpdateState = {
                    ...updateState,
                    needs: 'new-title',
                    newStartAt,
                    newEndAt,
                  };
                  send({
                    type: 'token',
                    text: `새 제목은 무엇으로 할까요? (예: '주간 회의', 그대로 유지하려면 '그대로')`,
                  });
                  send({
                    type: 'awaiting-input',
                    needs: 'new-title',
                    previousQuestion: question,
                    updateState: nextState,
                  });
                  break;
                }

                // === 단계 3: new-title — 사용자가 새 제목 답변 → confirm 카드 ===
                if (updateState && updateState.needs === 'new-title') {
                  const newTitle = KEEP_AS_IS_RE.test(question)
                    ? updateState.targetTitle
                    : extractNewTitle(question) || updateState.targetTitle;
                  const finalStartAt = updateState.newStartAt ?? updateState.targetStartAt;
                  const finalEndAt = updateState.newEndAt ?? updateState.targetEndAt;
                  // 변경 없음 가드.
                  if (
                    newTitle === updateState.targetTitle &&
                    finalStartAt === updateState.targetStartAt &&
                    finalEndAt === updateState.targetEndAt
                  ) {
                    send({ type: 'token', text: '변경할 내용이 없어요. 일정을 그대로 둘게요.' });
                    break;
                  }
                  const summary = formatUpdateConfirm({
                    targetTitle: updateState.targetTitle,
                    targetStartAt: updateState.targetStartAt,
                    targetEndAt: updateState.targetEndAt,
                    newTitle,
                    newStartAt: finalStartAt,
                    newEndAt: finalEndAt,
                  });
                  // 부분 PATCH — 변경된 필드만 전송 (백엔드는 부분 수정 지원).
                  const args: Record<string, unknown> = {
                    teamId,
                    scheduleId: updateState.targetScheduleId,
                  };
                  if (newTitle !== updateState.targetTitle) args.title = newTitle;
                  if (finalStartAt !== updateState.targetStartAt) args.startAt = finalStartAt;
                  if (finalEndAt !== updateState.targetEndAt) args.endAt = finalEndAt;
                  send({
                    type: 'pending-action',
                    pendingAction: { tool: 'updateSchedule', args },
                    preview: { ...args },
                    text: summary,
                  });
                  break;
                }

                // === 단계 1: 식별 (delete 와 동일 패턴) ===
                // "X Y로 수정/변경/바꿔" 패턴 사전 분리 — 새 일시(Y) 가 검색을 방해하지 않도록.
                // 예: "디자인 리뷰 일정 25일 오후 2시로 수정해줘"
                //   → search="디자인 리뷰 일정", newDT="25일 오후 2시"
                let searchQuestion = question;
                let initialNewDateTimeHint: string | null = null;
                // 날짜 단서 — "다음 주 화요일" 같은 "주 + 요일" 결합 패턴을 alternation 첫 자리에
                // 배치해 우선 매치 (regex alternation 은 좌측 우선). 단순 "다음 주" 만 잡혀
                // 요일이 검색 쪽으로 빠지는 케이스 방지.
                const UPDATE_TO_PATTERN_RE =
                  /^([\s\S]+?)\s+((?:(?:이번|다음|지난)\s*주\s+(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일)|(?:\d+\s*월\s*)?\d+\s*일|오늘|내일|모레|월요일|화요일|수요일|목요일|금요일|토요일|일요일|이번\s*주|다음\s*주|지난\s*주)?\s*(?:오전|오후|새벽)?\s*\d+\s*시(?:\s*(?:반|\d+\s*분))?)\s*(?:로|으로)\s+(?:수정|변경|바꿔|바꿔줘|고쳐|고쳐줘)/;
                const splitMatch = question.match(UPDATE_TO_PATTERN_RE);
                if (splitMatch) {
                  const newDtPart = splitMatch[2].trim();
                  if (
                    newDtPart &&
                    (HAS_TIMING_SIGNAL_RE.test(newDtPart) || HAS_TIME_SIGNAL_RE.test(newDtPart))
                  ) {
                    // "X 일정" 으로 끝나면 "일정" 트림 — RAG 가 검색 키워드를 더 정확히 잡도록.
                    searchQuestion = splitMatch[1].trim().replace(/\s*일정$/, '').trim();
                    initialNewDateTimeHint = newDtPart;
                    console.log(
                      `[schedule_update split] search="${searchQuestion}" newDT="${initialNewDateTimeHint}"`,
                    );
                  }
                }
                // 비지원 필드 가드 — 색깔/설명 등은 v1 multi-step 흐름이 처리 못 함.
                if (UNSUPPORTED_UPDATE_FIELD_RE.test(question)) {
                  send({
                    type: 'token',
                    text: 'AI 어시스턴트는 일정의 **일시·제목** 수정만 지원해요. 색깔·설명·메모는 캘린더 화면에서 직접 변경해 주세요. 🙏',
                  });
                  break;
                }
                // 벌크 가드 — 첫 발화에 "전체/모두/다 수정" 류 → 후보는 보여주되 안내 동시 발송.
                const bulkUpdate = BULK_INTENT_RE.test(searchQuestion);
                const tb = detectTimeBand(searchQuestion);
                if (tb.kind === 'ambiguous') {
                  if (tb.needsAmpm) {
                    send({
                      type: 'token',
                      text: `오전/오후 어느 쪽일까요? (예: '오후 ${tb.keyword}')`,
                    });
                    send({
                      type: 'awaiting-input',
                      needs: 'time',
                      previousQuestion: question,
                    });
                  } else {
                    send({
                      type: 'token',
                      text: `'${tb.keyword}'의 기준 시각이 모호해요. '오후 6시 이후 일정' 처럼 구체적으로 알려주세요.`,
                    });
                  }
                  break;
                }
                const band = tb.kind === 'objective' ? tb.band : null;
                const { schedules, range } = await runScheduleQuery({
                  question: searchQuestion,
                  teamId,
                  jwt,
                  band,
                });
                if (schedules.length === 0) {
                  send({
                    type: 'token',
                    text: `${formatSchedules(schedules, { teamName, range })}\n수정할 일정을 찾지 못했어요. 시점·제목을 더 구체적으로 알려주세요.`,
                  });
                  break;
                }
                if (schedules.length > 1) {
                  send({
                    type: 'sources',
                    sources: schedules.map((s) => ({
                      title: s.title,
                      startAt: s.startAt,
                      endAt: s.endAt,
                    })) as WebSource[],
                  });
                  const bulkNote = bulkUpdate
                    ? '\n(한 번에 하나의 일정만 수정할 수 있어요.) '
                    : '';
                  send({
                    type: 'token',
                    text: `${formatSchedules(schedules, { teamName, range })}\n어떤 일정을 수정할까요? 제목이나 시각을 더 구체적으로 알려주세요.${bulkNote}`,
                  });
                  send({
                    type: 'awaiting-input',
                    needs: 'title',
                    previousQuestion: question,
                  });
                  break;
                }
                // 단일 매치 — 수정 단계 진입 (새 일시 묻기).
                const s = schedules[0];
                const initState: UpdateState = {
                  needs: 'new-datetime',
                  targetScheduleId: s.id,
                  targetTitle: s.title,
                  targetStartAt: s.startAt,
                  targetEndAt: s.endAt,
                };
                // 첫 발화에 새 일시 힌트 포함 → 즉시 파싱해 new-title 단계로 자동 진입.
                if (initialNewDateTimeHint) {
                  let direct = tryParseDirectDatetime(
                    initialNewDateTimeHint,
                    s.startAt,
                    s.endAt,
                  );
                  // LLM fallback — tryParseDirectDatetime 은 요일/주 키워드("다음 주 화요일")
                  // 를 명시적으로 처리 안 함. parseScheduleArgs(RAG) 로 위임해 상대 날짜
                  // 매핑 표 기반 정확 변환. 제목 단서가 없으면 needs:'title' 떨어지므로 더미
                  // 제목 결합 후 호출 — 응답의 시각만 추출.
                  if (!direct) {
                    const llm = await parseScheduleArgs(`${initialNewDateTimeHint} 회의`);
                    if ('ok' in llm && llm.ok) {
                      direct = { startAt: llm.args.startAt, endAt: llm.args.endAt };
                    }
                  }
                  if (direct) {
                    const startMs = new Date(direct.startAt).getTime();
                    if (startMs >= Date.now() - 60_000) {
                      const nextState: UpdateState = {
                        ...initState,
                        needs: 'new-title',
                        newStartAt: direct.startAt,
                        newEndAt: direct.endAt,
                      };
                      const fmtKst = (iso: string) =>
                        new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
                      // endAt null → 시작시각만 표시.
                      const newRangeStr = direct.endAt
                        ? `${fmtKst(direct.startAt)} ~ ${fmtKst(direct.endAt)}`
                        : fmtKst(direct.startAt);
                      send({
                        type: 'token',
                        text: `수정할 일정을 찾았어요.\n• ${formatScheduleLine(s)}\n\n새 일시: ${newRangeStr}\n\n제목은 어떻게 할까요? (그대로 유지하려면 '그대로')`,
                      });
                      send({
                        type: 'awaiting-input',
                        needs: 'new-title',
                        previousQuestion: question,
                        updateState: nextState,
                      });
                      break;
                    }
                  }
                }
                send({
                  type: 'token',
                  text: `다음 일정을 수정합니다.\n• ${formatScheduleLine(s)}\n\n새 일시는 언제로 할까요? (예: '내일 오후 3시', 그대로 유지하려면 '그대로')`,
                });
                send({
                  type: 'awaiting-input',
                  needs: 'new-datetime',
                  previousQuestion: question,
                  updateState: initState,
                });
                break;
              }
              case 'blocked': {
                send({ type: 'meta', source: 'blocked', classification: cls });
                send({ type: 'token', text: blockedMessage(cls.subreason) });
                break;
              }
              // 'unknown' 이하 default 분기는 RAG/웹 분기에 따라 다른 model 적용
              case 'unknown':
              default: {
                // RAG 시도 후 거절형이면 Open WebUI fallback (기존 패턴 유지)
                let ragData: Record<string, unknown> | null = null;
                try {
                  ragData = await callRagChat(question, topK);
                } catch {
                  ragData = null;
                }
                const ragAnswer = typeof ragData?.answer === 'string' ? ragData.answer : '';
                if (ragData && !isRefusal(ragAnswer)) {
                  send({
                    type: 'meta',
                    source: 'rag',
                    classification: { ...cls, fallback: 'rag-answered' },
                    ...ragMeta,
                  });
                  if (Array.isArray(ragData.sources)) {
                    send({ type: 'sources', sources: ragData.sources as WebSource[] });
                  }
                  send({ type: 'token', text: ragAnswer });
                } else {
                  send({
                    type: 'meta',
                    source: 'web',
                    classification: { ...cls, fallback: 'rag-refused' },
                    ...webMeta,
                  });
                  await streamOpenWebUi(question, send);
                  const sources = await searxngQuery(question);
                  if (sources.length) send({ type: 'sources', sources });
                }
                break;
              }
            }
            send({ type: 'done' });
          } catch (err) {
            const message =
              err instanceof BackendError
                ? `백엔드 오류 (${err.status}): ${err.message}`
                : err instanceof Error
                ? err.message
                : String(err);
            send({ type: 'error', message });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        },
      });
    }

    // === Non-stream ===
    switch (cls.intent) {
      case 'usage': {
        const data = await callRagChat(question, topK);
        return NextResponse.json({ ...data, source: 'rag', classification: cls, ...ragMeta });
      }
      case 'general': {
        const ow = await callOpenWebUi(question);
        return NextResponse.json({
          answer: ow.answer,
          sources: ow.sources,
          source: 'web',
          classification: { ...cls, fallback: 'general-keyword-direct' },
          ...webMeta,
        });
      }
      case 'schedule_query': {
        const tb = detectTimeBand(question);
        if (tb.kind === 'ambiguous') {
          // non-stream 경로 — awaiting-input 메커니즘 없음 (panel 은 stream 사용).
          // 메시지만 needsAmpm 여부에 따라 다르게.
          const answer = tb.needsAmpm
            ? `오전/오후 어느 쪽일까요? (예: '오후 ${tb.keyword}')`
            : `'${tb.keyword}'의 기준 시각이 모호해요. '오후 6시 이후 일정' 처럼 구체적으로 알려주세요.`;
          return NextResponse.json({
            answer,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        const band = tb.kind === 'objective' ? tb.band : null;
        const { schedules, range } = await runScheduleQuery({ question, teamId, jwt, band });
        return NextResponse.json({
          answer: formatSchedules(schedules, { teamName, range }),
          sources: schedules,
          source: 'schedule',
          classification: cls,
          ...ragMeta,
        });
      }
      case 'schedule_create': {
        // bare 1~12시 모호 가드 (스트림 경로와 동일 정책)
        const tbCreate = detectTimeBand(question);
        if (tbCreate.kind === 'ambiguous' && tbCreate.needsAmpm) {
          return NextResponse.json({
            answer: `오전/오후 어느 쪽일까요? (예: '오후 ${tbCreate.keyword}')`,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        const parsed = await parseScheduleArgs(question);
        if (!parsed.ok) {
          // 시스템 오류 (Ollama 미연결, JSON 파싱 실패 등) — 입력 부족과 분리해 노출.
          // needs='date'/'time' 인 경우, 사용자 입력 신호 검사 후 통합·개별 묻기로 보정 (스트림 경로와 동일 정책).
          let answer: string;
          if ('error' in parsed) {
            answer = `AI 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.\n(원인: ${parsed.error})`;
          } else if ('needs' in parsed && (parsed.needs === 'date' || parsed.needs === 'time')) {
            const hasDate = HAS_TIMING_SIGNAL_RE.test(question);
            const hasTime = HAS_TIME_SIGNAL_RE.test(question);
            if (!hasDate && !hasTime) answer = `일시는 언제로 할까요? (예: '내일 오후 3시')`;
            else if (!hasDate) answer = `일자는 언제로 할까요? (예: '내일' 또는 '5월 15일')`;
            else if (!hasTime) answer = `시간은 언제로 할까요? (예: '오후 3시')`;
            else answer = parsed.hint; // 둘 다 있는데 LLM 이 needs 떨어뜨린 케이스 — RAG hint 그대로
          } else if ('needs' in parsed) {
            answer = parsed.hint;
          } else {
            answer = `좀 더 구체적으로 말씀해 주시겠어요?\n(예: "내일 오후 3시 주간 회의 등록해줘")`;
          }
          return NextResponse.json({
            answer,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        return NextResponse.json({
          kind: 'confirm',
          answer: `다음 내용으로 일정 등록할까요?`,
          preview: parsed.args,
          pendingAction: {
            tool: 'createSchedule',
            args: { ...parsed.args, teamId },
          },
          source: 'schedule',
          classification: cls,
          ...ragMeta,
        });
      }
      case 'schedule_delete': {
        const tb = detectTimeBand(question);
        if (tb.kind === 'ambiguous') {
          const answer = tb.needsAmpm
            ? `오전/오후 어느 쪽일까요? (예: '오후 ${tb.keyword}')`
            : `'${tb.keyword}'의 기준 시각이 모호해요. '오후 6시 이후 일정' 처럼 구체적으로 알려주세요.`;
          return NextResponse.json({
            answer,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        const band = tb.kind === 'objective' ? tb.band : null;
        const { schedules, range } = await runScheduleQuery({ question, teamId, jwt, band });
        if (schedules.length === 0) {
          return NextResponse.json({
            answer: `${formatSchedules(schedules, { teamName, range })}\n삭제할 일정을 찾지 못했어요. 시점·제목을 더 구체적으로 알려주세요.`,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        if (schedules.length > 1) {
          return NextResponse.json({
            answer: `${formatSchedules(schedules, { teamName, range })}\n어떤 일정을 삭제할까요? 제목이나 시각을 더 구체적으로 알려주세요.`,
            sources: schedules,
            source: 'schedule',
            classification: cls,
            ...ragMeta,
          });
        }
        const s = schedules[0];
        return NextResponse.json({
          kind: 'confirm',
          answer: `다음 일정을 삭제할까요?\n\n• ${formatScheduleLine(s)}`,
          preview: { id: s.id, title: s.title, startAt: s.startAt, endAt: s.endAt },
          pendingAction: {
            tool: 'deleteSchedule',
            args: { teamId, scheduleId: s.id },
          },
          source: 'schedule',
          classification: cls,
          ...ragMeta,
        });
      }
      case 'schedule_update': {
        // non-stream 경로 — multi-step (new-datetime → new-title) 진행 불가.
        // 식별 단계까지만 처리하고 stream 사용을 권장.
        return NextResponse.json({
          answer:
            '일정 수정은 스트리밍 채팅 패널을 사용해 주세요. (단계별 입력이 필요한 흐름입니다.)',
          source: 'schedule',
          classification: cls,
          ...ragMeta,
        });
      }
      case 'blocked': {
        return NextResponse.json({
          answer: blockedMessage(cls.subreason),
          source: 'blocked',
          classification: cls,
        });
      }
      default: {
        // unknown — RAG 시도 + Open WebUI fallback
        let ragData: Record<string, unknown> | null = null;
        try {
          ragData = await callRagChat(question, topK);
        } catch {
          ragData = null;
        }
        const ragAnswer = typeof ragData?.answer === 'string' ? ragData.answer : '';
        if (ragData && !isRefusal(ragAnswer)) {
          return NextResponse.json({
            ...ragData,
            source: 'rag',
            classification: { ...cls, fallback: 'rag-answered' },
            ...ragMeta,
          });
        }
        const ow = await callOpenWebUi(question);
        return NextResponse.json({
          answer: ow.answer,
          sources: ow.sources,
          source: 'web',
          classification: { ...cls, fallback: 'rag-refused' },
          ...webMeta,
        });
      }
    }
  } catch (err) {
    const message =
      err instanceof BackendError
        ? err.status === 401
          ? '로그인이 만료됐어요. 메인 화면에서 다시 로그인해 주세요.'
          : err.status === 403
          ? '이 팀에 대한 권한이 없어요.'
          : `요청 처리 실패 (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : String(err);
    const hint =
      message.includes('ECONNREFUSED') || message.includes('fetch failed')
        ? 'AI 서버에 연결할 수 없습니다. rag(8787) / open-webui(8081) / backend 중 어느 하나가 미응답입니다.'
        : message;
    return NextResponse.json({ error: hint }, { status: 502 });
  }
}
