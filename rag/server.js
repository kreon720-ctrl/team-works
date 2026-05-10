import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { retrieve } from "./retriever.js";
import { buildMessages } from "./promptBuilder.js";
import { chat, chatStreamRaw } from "./ollamaClient.js";
import { resolveChatModel } from "./modelResolver.js";
import { SERVER_PORT, TOP_K } from "./config.js";

// 분류 규칙 md 파일을 부팅 시 1회 로드해 LLM 분류기 system prompt 로 사용.
// 운영자가 분류 정책을 코드 변경 없이 편집할 수 있게 외부화.
// 파일 없으면 명시 throw — 핵심 의존성으로 다룸.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFY_RULES_PATH = path.join(__dirname, "docs", "classify-rules.md");
const CLASSIFY_RULES = fs.readFileSync(CLASSIFY_RULES_PATH, "utf8");

// 한자 숫자(Sino-Korean) 날짜 표현을 아라비아 숫자로 정규화.
// 예: "오월 사일" → "5월 4일", "유월 십오일" → "6월 15일", "삼십일일" → "31일".
// LLM 에 보내기 전에 한 번 적용 — 작은 모델이 못 외우는 매핑 부담을 결정론적 코드로 대체.
const KOREAN_MONTH_MAP = [
  ["십이월", "12월"], ["십일월", "11월"],
  ["일월", "1월"], ["이월", "2월"], ["삼월", "3월"], ["사월", "4월"], ["오월", "5월"],
  ["유월", "6월"], ["칠월", "7월"], ["팔월", "8월"], ["구월", "9월"], ["시월", "10월"],
];
// 일(day) 매핑 — 길이 내림차순 (greedy longest match) 으로 정렬.
// "삼십일일" 이 "삼십일" 로 잘리지 않도록.
const KOREAN_DAY_MAP = [
  ["삼십일일", "31일"], ["이십구일", "29일"], ["이십팔일", "28일"], ["이십칠일", "27일"],
  ["이십육일", "26일"], ["이십오일", "25일"], ["이십사일", "24일"], ["이십삼일", "23일"],
  ["이십이일", "22일"], ["이십일일", "21일"],
  ["삼십일", "30일"], ["이십일", "20일"],
  ["십구일", "19일"], ["십팔일", "18일"], ["십칠일", "17일"], ["십육일", "16일"],
  ["십오일", "15일"], ["십사일", "14일"], ["십삼일", "13일"], ["십이일", "12일"],
  ["십일일", "11일"], ["십일", "10일"],
  ["일일", "1일"], ["이일", "2일"], ["삼일", "3일"], ["사일", "4일"], ["오일", "5일"],
  ["육일", "6일"], ["칠일", "7일"], ["팔일", "8일"], ["구일", "9일"],
];
function normalizeKoreanDate(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  // 월: 단순 치환 (어미 충돌 적음).
  for (const [k, v] of KOREAN_MONTH_MAP) {
    out = out.split(k).join(v);
  }
  // 일: 뒤따르는 한글이 있으면 단어 일부 가능성 → lookahead 로 제외.
  // 예: "일일이" (= one by one) 에서 "일일" 만 떼어 "1일" 로 바꾸면 안 됨.
  for (const [k, v] of KOREAN_DAY_MAP) {
    out = out.replace(new RegExp(k + "(?![가-힣])", "g"), v);
  }
  return out;
}

// TEAM WORKS 도메인 키워드 — 매치되면 강한 사용법 시그널로 보고 즉시 RAG 라우팅.
// 단, SCHEDULE_KEYWORDS 와 동시 매치되면 일정 의도가 우선.
const HARD_KEYWORDS = [
  "team works", "팀웍스", "팀 워크스", "찰떡",
  "포스트잇", "공지사항", "업무보고", "가입 신청",
  "프로젝트 일정", "세부 일정", "간트차트",
  "팀장", "팀원", "팀 채팅",
];
// 명백한 일반 질문 시그널 — 매치 시 RAG 답변 시도(약 50초) 를 스킵하고
// 곧장 web 라우팅 신호 반환. route.ts 가 이 신호를 보고 Open WebUI 직접 호출.
const GENERAL_KEYWORDS = [
  "뉴스", "날씨", "주가", "주식", "환율", "시세",
  "오늘의", "최신", "헤드라인", "스포츠 결과", "경기 결과",
  "검색해줘", "에 대해 알려줘", "에 대해 검색",
];
// 일정 관련 명사 — 동작 키워드와 결합되면 schedule_query 또는 schedule_create.
// "팀 일정" 도 사용법(HARD)·일정 조회 둘 다 가능 — 일정 키워드가 우선.
const SCHEDULE_NOUNS = [
  "일정", "회의", "미팅", "약속", "스케줄", "팀 일정",
];
// 조회 동작
const SCHEDULE_QUERY_VERBS = [
  "알려", "보여", "확인", "조회", "찾아", "있어", "있나", "있는", "어때", "어떤",
];
// 등록 동작
const SCHEDULE_CREATE_VERBS = [
  "등록", "추가", "만들", "잡아", "예약", "넣어", "생성",
];
// 거절 대상 동작 — "취소" 는 의미 모호 (삭제 vs 일정 통보 취소) 하므로 안전하게 거절.
const BLOCKED_VERBS = [
  "취소",
];
// 삭제 동작 — 일정 + deleteVerb 면 schedule_delete (등록과 동일하게 confirm 후 실행).
const SCHEDULE_DELETE_VERBS = [
  "삭제", "제거", "지워", "지운",
];
// 수정 동작 — 일정 + updateVerb 면 schedule_update (식별 → 새 일시 → 새 제목 → confirm).
// "옮겨/옮기" 는 시각 이동도 의미 — 같은 update 분기로 처리.
const SCHEDULE_UPDATE_VERBS = [
  "수정", "변경", "바꿔", "옮겨", "옮기",
];
// 거절 대상 도메인 — 프로젝트·채팅 관련은 도메인 자체로 거절.
const BLOCKED_DOMAINS = [
  "프로젝트", "채팅", "메시지", "공지", "공지사항", "업무보고", "포스트잇",
];
// 사용법 질문 시그널 — 매치되면 다른 분기보다 우선해 usage(RAG) 로 라우팅.
// 예: "프로젝트 등록하는 법", "회의 어떻게 만들어?" — blocked/schedule_create 가 아니라 사용법 답변이 정답.
// 개념·정의·비교 질문 시그널도 포함 — "프로젝트 일정과 세부일정의 차이점", "X 가 무엇인지 설명해줘" 류는
// 일정 명사가 들어 있어도 schedule_query 가 아니라 RAG 기반 사용법 답변이 정답.
// 모호 단어("설명", "차이", "뭐", "무엇") 단독은 schedule field/일반 질의와 충돌하므로 제외 — 명확한 phrase 형태로만 매치.
const USAGE_KEYWORDS = [
  "사용법", "방법", "어떻게", "어떡", "하는 법", "쓰는 법", "쓰는 방법", "이용법", "사용 방법",
  // 개념·정의 질문
  "차이점", "차이가 뭐", "차이가 무엇", "다른점", "다른 점",
  "무엇인지", "뭐인지", "뭐가 다른", "뭐가 달라",
  // 설명 요청
  "설명해줘", "설명해주세요", "설명해 줘", "설명 부탁",
  // 능력·지원 여부 질문 — "찰떡아 X 가능해?" / "X 할 수 있어?" 류는 capability question.
  // schedule 동사(수정/삭제 등)가 들어 있어도 schedule_*  로 떨어지지 않게 priority 0 에서 catch.
  "가능해", "가능한가", "가능한지", "가능할까", "가능합니까",
  "할 수 있어", "할 수 있나", "할 수 있는지", "할 수 있을까", "할 수 있습니까",
  "할수있어", "할수있나", "할수있는지",
  "지원해", "지원하나", "지원되나", "지원하는지", "지원합니까",
];
// 시간 질의 표지자 — "언제", "몇 시", "며칠" 같이 시간을 묻는 표현은 거의 항상 일정 조회 의도.
// SCHEDULE_NOUNS 매치가 안 돼도 (예: 사용자가 일정 제목을 직접 부른 경우 — '신체검사 언제야')
// 이 표지자가 있으면 schedule_query 로 분류해 LLM stochastic 의존 우회.
// USAGE_KEYWORDS / BLOCKED_VERBS / BLOCKED_DOMAINS 가 우선순위에서 먼저 잡으므로 false positive 위험은 낮음.
const TIME_QUERY_KEYWORDS = [
  "언제", "몇 시", "몇시", "며칠",
];

// 키워드 매치 헬퍼 — 매치된 첫 키워드 반환, 없으면 null.
function findMatch(q, list) {
  return list.find((k) => q.includes(k)) ?? null;
}

// "X법" / "X 법" 단독 어휘 — 사용자가 사용법을 물을 때 자주 쓰는 표현.
// USAGE_KEYWORDS 의 "하는 법" 같은 합성 패턴은 못 잡는 케이스 (예: "일정등록 법", "조회법") 흡수.
// 어절 경계 (선두/공백 → 한글+ → 선택적 공백 → 법 → 어절 종료) 로 매치 — '방법론' 같은 합성어는 제외.
const USAGE_LAW_RE = /(?:^|\s)[가-힣]+\s*법(?=\s|[?!.,]|$)/;

// 의도 분류 — 6-way + blocked.
// 우선순위:
//  0) USAGE_KEYWORDS(사용법 시그널) → 즉시 usage (다른 분기보다 우선)
//  0b) USAGE_LAW_RE ("X법" / "X 법" 단독 어휘 패턴) → usage
//  1) 일정명사 + 거절동작(취소) → blocked (schedule_modify)
//  2) 거절도메인 + 동작(create/update/delete) → blocked (other_domain)
//  3) 일정명사 + 삭제동작 → schedule_delete  (confirm 후 실행)
//  4) 일정명사 + 수정동작 → schedule_update (식별 → 새 일시 → 새 제목 → confirm)
//  5) 일정명사 + 등록동작 → schedule_create
//  6) 일정명사 + 조회동작 (또는 일정명사 단독) → schedule_query
//  7) HARD_KEYWORDS → usage
//  8) GENERAL_KEYWORDS → general (뉴스/날씨/주가 등 — 일정 조회 아님)
//  8b) 시간 질의 표지자 ("언제" 등) → schedule_query (일정명사 미매치라도 fallback)
//      — GENERAL_KEYWORDS 다음에 두어 '오늘 뉴스 언제 봐?' 같은 false positive 회피.
//  9) 매치 없음 → unknown (route.ts 가 RAG 시도 후 거절형이면 general fallback)
function classifyIntent(question) {
  const q = question.trim().toLowerCase();

  // 0) 사용법 질문 시그널 우선 — "프로젝트 등록하는 법" 같은 사용법 질의가 blocked 로 빠지는 걸 방지.
  const usage = findMatch(q, USAGE_KEYWORDS);
  if (usage) return { intent: "usage", reason: "usage-keyword", matched: usage };
  // 0b) 'X법' / 'X 법' 단독 어휘 — 예: '일정등록 법 알려줘', '조회법 알려줘'.
  const usageLaw = q.match(USAGE_LAW_RE);
  if (usageLaw) return { intent: "usage", reason: "usage-pattern", matched: usageLaw[0].trim() };

  const noun = findMatch(q, SCHEDULE_NOUNS);
  const blockedVerb = findMatch(q, BLOCKED_VERBS);
  const deleteVerb = findMatch(q, SCHEDULE_DELETE_VERBS);
  const updateVerb = findMatch(q, SCHEDULE_UPDATE_VERBS);
  const createVerb = findMatch(q, SCHEDULE_CREATE_VERBS);
  const queryVerb = findMatch(q, SCHEDULE_QUERY_VERBS);
  const blockedDomain = findMatch(q, BLOCKED_DOMAINS);

  // 1) 일정 + 거절동작(취소) → blocked
  if (noun && blockedVerb) {
    return { intent: "blocked", subreason: "schedule_modify", matched: `${noun}+${blockedVerb}` };
  }
  // 2) 거절도메인 + 어떤 동작 → blocked
  if (blockedDomain && (blockedVerb || createVerb || deleteVerb || updateVerb)) {
    return { intent: "blocked", subreason: "other_domain", matched: blockedDomain };
  }
  // 3) 일정 + 삭제동작 → schedule_delete (updateVerb·createVerb 보다 먼저 — "삭제 변경" 류는 삭제 우선)
  if (noun && deleteVerb) {
    return { intent: "schedule_delete", reason: "keyword", matched: `${noun}+${deleteVerb}` };
  }
  // 4) 일정 + 수정동작 → schedule_update (createVerb 보다 먼저 — "수정 등록" 류는 수정 우선)
  if (noun && updateVerb) {
    return { intent: "schedule_update", reason: "keyword", matched: `${noun}+${updateVerb}` };
  }
  // 5) 일정 + 등록동작 → schedule_create
  if (noun && createVerb) {
    return { intent: "schedule_create", reason: "keyword", matched: `${noun}+${createVerb}` };
  }
  // 5b) 일정 noun 없어도 명확한 datetime + 등록동작 → schedule_create 추론.
  //     예: "13일 오후 2시20분 고속버스 티켓 예매 등록" — 일정/약속 noun 미명시이지만
  //     날짜·시각 + 등록 동사 조합이면 사용자 의도는 schedule_create.
  //     날짜·시각 둘 다 있어야 함 (둘 중 하나만이면 시각 단독 질의 등 다른 의도일 수 있음).
  if (createVerb && /\d+\s*일|어제|오늘|내일|모레|글피|월요일|화요일|수요일|목요일|금요일|토요일|일요일/.test(q) && /\d+\s*시|\d+\s*[:：]\s*\d+|오전|오후|새벽|아침|점심|저녁|밤|정오|자정/.test(q)) {
    return { intent: "schedule_create", reason: "datetime+verb", matched: createVerb };
  }
  // 6) 일정명사 + 조회동작 (또는 단독) → schedule_query
  if (noun && (queryVerb || !createVerb)) {
    return { intent: "schedule_query", reason: "keyword", matched: noun };
  }
  // 5) HARD_KEYWORDS → usage
  const hard = findMatch(q, HARD_KEYWORDS);
  if (hard) return { intent: "usage", reason: "keyword", matched: hard };
  // 6) GENERAL_KEYWORDS → general
  const gen = findMatch(q, GENERAL_KEYWORDS);
  if (gen) return { intent: "general", reason: "general-keyword", matched: gen };
  // 6b) 시간 질의 표지자만 있어도 schedule_query — 일정 제목을 직접 부른 케이스 흡수.
  //     예: "신체검사 언제야", "회식 언제 시작해?", "5월 1일 데모 언제야"
  //     GENERAL_KEYWORDS 까지 모두 통과한 시점이라 '오늘 뉴스 언제' 같은 false positive 회피.
  //     BLOCKED_DOMAINS 가 동시 매치면 우회 — '프로젝트 채팅 언제 됐어?' 같은 케이스는 LLM 재분류로.
  const timeQuery = findMatch(q, TIME_QUERY_KEYWORDS);
  if (timeQuery && !blockedDomain) {
    return { intent: "schedule_query", reason: "time-query", matched: timeQuery };
  }
  // 7) 매치 없음
  return { intent: "unknown", reason: "no-keyword" };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    const model = await resolveChatModel();
    res.json({ ok: true, model });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message || String(err) });
  }
});

// LLM 분류기 — 키워드가 위험 분기(blocked/unknown)로 떨어뜨린 입력에 대해
// docs/classify-rules.md 를 system prompt 로 LLM 의미 기반 재분류.
// /parse-schedule-* 와 같은 패턴: temperature 0.1 + 짧은 num_predict + JSON 정규식 추출 + 실패 throw.
const VALID_INTENTS = ["usage", "general", "schedule_query", "schedule_create", "schedule_delete", "schedule_update", "blocked", "unknown"];

async function classifyIntentLLM(question, model) {
  const result = await chat(
    model,
    [
      { role: "system", content: CLASSIFY_RULES },
      { role: "user", content: question },
    ],
    { temperature: 0.1, num_predict: 96 }
  );
  const raw = result.message?.content || "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("classify-llm: JSON 추출 실패");
  const parsed = JSON.parse(m[0]);
  if (!VALID_INTENTS.includes(parsed.intent)) {
    throw new Error(`classify-llm: invalid intent ${parsed.intent}`);
  }
  return {
    intent: parsed.intent,
    reason: typeof parsed.reason === "string" ? parsed.reason : "llm",
  };
}

// 키워드 분류 + 위험 분기(blocked/unknown)일 때 LLM 검증.
// 응답: { intent, reason?, subreason?, matched?, isTeamWorks, ... }
//   - 위험 분기에서 LLM 이 다른 의도 반환 시 override + kwIntent 기록
//   - LLM 동의 시 llmConfirmed:true
//   - LLM 실패/timeout 시 llmError 기록 + 키워드 결과 fallback
// `isTeamWorks` 는 backward-compat — `intent === 'usage'` 와 동치.
const LLM_TIMEOUT_MS = 6000;

app.post("/classify", async (req, res) => {
  const { question } = req.body ?? {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "`question` (string) is required" });
  }
  const kw = classifyIntent(question);

  // fast-path — 명확한 분류는 키워드 결과 그대로
  if (kw.intent !== "blocked" && kw.intent !== "unknown") {
    return res.json({ ...kw, isTeamWorks: kw.intent === "usage" });
  }

  // 위험 분기 — LLM 검증
  try {
    const model = await resolveChatModel();
    const llmPromise = classifyIntentLLM(question, model);
    const timeoutPromise = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("llm-timeout")), LLM_TIMEOUT_MS)
    );
    const llm = await Promise.race([llmPromise, timeoutPromise]);

    // LLM 이 다른 intent → override
    if (llm.intent !== kw.intent) {
      return res.json({
        intent: llm.intent,
        reason: "llm-override",
        kwIntent: kw.intent,
        llmReason: llm.reason,
        isTeamWorks: llm.intent === "usage",
      });
    }
    // LLM 동의 → 키워드 결과 유지
    return res.json({
      ...kw,
      llmConfirmed: true,
      isTeamWorks: kw.intent === "usage",
    });
  } catch (err) {
    // LLM 실패/timeout → 키워드 결과로 fallback
    return res.json({
      ...kw,
      llmError: String(err.message || err),
      isTeamWorks: kw.intent === "usage",
    });
  }
});

// 일정 등록 자연어 → 인자 파싱.
// 입력: { question, nowIso? } — nowIso 는 사용자 시점 (KST 보정 등). 미지정 시 서버 시간.
// 출력: { ok:true, args: { title, startAt, endAt, description?, color? } } 또는 { ok:false, error }
//   - startAt/endAt 은 ISO 8601 (UTC). LLM 이 사용자의 KST 표현을 KST→UTC 로 변환해 반환.
// "Y일" (월 미명시 단독 일자) → 가장 가까운 미래 (year-month-day) 매핑 표 생성.
// LLM 이 일자 단독을 과거로 떨어뜨리는 환각 방지용 — system prompt 에 미리 계산된 표 동봉.
// parseScheduleArgs / parseScheduleQuery 둘 다 사용.
function buildDayMappingTable(kstNow) {
  const todayDay = kstNow.getUTCDate();
  const todayMonth = kstNow.getUTCMonth();
  const todayYear = kstNow.getUTCFullYear();
  const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lines = [];
  for (let d = 1; d <= 31; d++) {
    let y = todayYear, m = todayMonth;
    if (d >= todayDay && d <= lastDayOfMonth(y, m)) {
      // 이번 달 사용
    } else {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      while (d > lastDayOfMonth(y, m)) {
        m += 1;
        if (m > 11) { m = 0; y += 1; }
      }
    }
    const ymd = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    lines.push(`  - "${d}일" → ${ymd}`);
  }
  return lines.join("\n");
}

// gemma4:26b think:false 로 짧은 JSON 응답 유도. JSON 파싱 실패 시 { ok:false }.
app.post("/parse-schedule-args", async (req, res) => {
  const { question: rawQuestion, nowIso } = req.body ?? {};
  if (!rawQuestion || typeof rawQuestion !== "string") {
    return res.status(400).json({ error: "`question` (string) is required" });
  }
  // 한자 숫자 날짜 정규화 ("오월 사일" → "5월 4일") — LLM 부담 최소화.
  const question = normalizeKoreanDate(rawQuestion);
  const now = nowIso || new Date().toISOString();
  // KST 캘린더 좌표 추출 — LLM 의 요일·"이번 주" 추론 정확도 향상.
  const kstNow = new Date(new Date(now).getTime() + 9 * 60 * 60 * 1000);
  const kstDateStr = kstNow.toISOString().slice(0, 10);
  const kstWeekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const kstDow = kstNow.getUTCDay(); // 0=일 ~ 6=토
  const kstWeekday = kstWeekdays[kstDow];

  // 이번 주 일~토 7일을 LLM 에게 직접 매핑 표로 제공 — 추론 부담 제거.
  const sundayUtc = new Date(Date.UTC(
    kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - kstDow
  ));
  const weekMapping = kstWeekdays.map((wd, i) => {
    const d = new Date(sundayUtc.getTime() + i * 24 * 60 * 60 * 1000);
    return `  - 이번 주 ${wd}: ${d.toISOString().slice(0, 10)}`;
  }).join("\n");
  const nextWeekMapping = kstWeekdays.map((wd, i) => {
    const d = new Date(sundayUtc.getTime() + (i + 7) * 24 * 60 * 60 * 1000);
    return `  - 다음 주 ${wd}: ${d.toISOString().slice(0, 10)}`;
  }).join("\n");
  const lastWeekMapping = kstWeekdays.map((wd, i) => {
    const d = new Date(sundayUtc.getTime() + (i - 7) * 24 * 60 * 60 * 1000);
    return `  - 지난주 ${wd}: ${d.toISOString().slice(0, 10)}`;
  }).join("\n");

  // "Y일" 단독 → 가장 가까운 미래 매핑 표 (helper 사용 — query endpoint 와 공유).
  const dayMappingTable = buildDayMappingTable(kstNow);

  const sysPrompt = `당신은 한국어 일정 등록 요청을 JSON 으로 변환합니다.\n현재 KST 날짜: ${kstDateStr} (${kstWeekday})\n사용자는 한국 시간대(KST)로 말한다고 가정. 출력도 KST 그대로 (UTC 변환은 서버가 함 — 절대 빼지 마세요).\n\n반드시 다음 둘 중 하나의 JSON 만 출력 (마크다운 금지):\n\n[A. 정보 충분 — 인자 반환]\n{"ok":true,"title":"...","startKst":"YYYY-MM-DDTHH:MM:SS","endKst":"YYYY-MM-DDTHH:MM:SS","description":""}\n\n[B. 정보 부족 — 후속 질문]\n{"ok":false,"needs":"time"|"date"|"title","hint":"한국어 한 문장 후속 질문"}\n\n날짜 추론 규칙 (오늘=${kstDateStr}(${kstWeekday}) 기준):\n- "오늘" → ${kstDateStr}\n- "내일" → 오늘 + 1일\n- "어제" → 오늘 - 1일\n- "X월 Y일" 연도 미명시 → 가장 가까운 미래 (오늘 이후의 X월 Y일).\n- "Y일" (월 미명시, 단독 일자) → **아래 매핑 표 그대로 사용**. 절대 추론·계산 금지. 과거 날짜 출력 금지.\n- 해당 월에 그 일자가 존재하지 않으면 (예: 4월 31일) 매핑 표대로 다음 달로 점프.\n- **절대 규칙**: "N일" / "Y일" 표기는 **달력 날짜** 입니다. "N일 전/후/뒤" 같은 상대 키워드가 명시되어 있지 않으면 절대 상대 기간으로 해석 금지. 예: "1일 점심 약속" 은 "다음 1일의 점심 약속" 이지 "1일 전 점심" 이 아닙니다 — 매핑 표를 그대로 사용.\n\n[Y일 단독 매핑 표 — 가장 가까운 미래]\n${dayMappingTable}\n\n요일 매핑 — 사용자가 "이번 주/다음 주/지난주 X요일" 이라고 말하면 **아래 표를 그대로 사용**. 추론·계산 금지.\n\n[이번 주 (일~토)]\n${weekMapping}\n\n[다음 주]\n${nextWeekMapping}\n\n[지난주]\n${lastWeekMapping}\n\n시각 표기 규칙 (간단 — 24시간 매핑만):\n- 출력은 한국 시간(KST) 그대로 24시간 형식 \`HH:MM:SS\`. UTC 변환·시차 계산 절대 금지.\n- "오전 N시" → \`0N:00:00\` (1<=N<=11) 또는 \`12:00:00\` (오전 12시 = 자정).\n- "오후 N시" → \`(N+12):00:00\` (1<=N<=11) 또는 \`12:00:00\` (오후 12시 = 정오).\n- "정오" → \`12:00:00\`. "자정" → \`00:00:00\`.\n- 24시간 표기 (13시·14시 등) → 그대로.\n- 예: "내일 오후 3시 회의" (오늘=${kstDateStr}) → startKst="${kstDateStr.slice(0, 8)}${String(kstNow.getUTCDate() + 1).padStart(2, "0")}T15:00:00", endKst=시작+1시간.\n- 예: "오후 1시" → 13:00:00. "오전 9시" → 09:00:00. "오전 11시 30분" → 11:30:00.\n\nA(완성) vs B(부족) 결정 규칙 (이 순서대로 검사):\n- 날짜가 명시 안 됨 또는 모호("회의 잡아줘", "다음에", "곧"...) → B, needs="date", hint="언제로 잡을까요?"\n- 시각이 명시 안 됨 또는 모호("오전?", "오후?", "조만간", "아침", "점심", "저녁", "야식") → B, needs="time", hint="몇 시에 잡을까요?" (식사 키워드는 시각이 아니라 이벤트 명사 — 구체 시각이 없으면 후속 질문)\n- **시각 모호 — AM/PM 미명시**: 사용자가 단순히 "1시", "5시" 처럼 12 이하 숫자만 말하고 "오전/오후/새벽/정오/자정" 같은 시간대 표현이 없으면 → B, needs="time", hint="오전/오후 어느 쪽일까요? (예: '오후 1시')". 13시 이상 24시간 표기는 명확하므로 OK.\n- **절대 금지**: 사용자가 시각을 한 글자도 명시 안 했으면 9시·10시·12시 같은 임의 시각을 절대 채우지 말 것. 무조건 needs="time".\n- 예: "5월 1일 주간회의 등록해줘" → {"ok":false,"needs":"time","hint":"몇 시에 잡을까요?"} (절대 9시·10시 등 임의 시각 채우면 안 됨)\n- 제목이 전혀 없으면 → B, needs="title", hint="회의 제목은 무엇으로 할까요?"\n- 위 모두 갖춰지면 → A. 종료 시각 미명시면 시작+1시간 가정 OK.\n- 제목은 사용자 표현 짧게(10자 내외). description 는 명시 안 하면 빈 문자열.\n- "Y일 일정 등록해줘" 처럼 일자만 있고 시각이 없으면 → B, needs="time" (날짜는 매핑 표로 결정 가능하나 시각이 없으므로 후속 질문).\n\n절대 JSON 외 다른 문자 출력 금지.`;

  try {
    const model = await resolveChatModel();
    const result = await chat(model, [
      { role: "system", content: sysPrompt },
      { role: "user", content: question },
    ], { temperature: 0.1, num_predict: 256 });
    const raw = result.message?.content || "";
    // 디버깅용 raw 로깅 — 평소엔 꺼져있음. LOG_LLM_RAW=true npm run server 로 활성화.
    if (process.env.LOG_LLM_RAW === "true") {
      console.log(`[parse-schedule-args] q="${question}"\n  raw="${raw}"`);
    }
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return res.json({ ok: false, error: "JSON 추출 실패", raw });
    let parsed;
    try {
      parsed = JSON.parse(m[0]);
    } catch (e) {
      return res.json({ ok: false, error: `JSON 파싱 실패: ${e.message}`, raw });
    }
    // B — 정보 부족
    if (parsed.ok === false && typeof parsed.needs === "string") {
      return res.json({
        ok: false,
        needs: parsed.needs,
        hint: typeof parsed.hint === "string" ? parsed.hint : "더 자세히 알려주세요.",
      });
    }
    // A — 인자 반환. LLM 은 KST 로 출력 (startKst/endKst). 서버가 UTC 로 변환.
    // 구버전 호환: 옛 LLM 출력 (startAt/endAt UTC) 도 그대로 받아들임.
    const startKst = parsed.startKst ?? null;
    const endKst = parsed.endKst ?? null;
    const legacyStartAt = parsed.startAt ?? null;
    const legacyEndAt = parsed.endAt ?? null;
    const title = parsed.title ?? null;
    const description = parsed.description ?? "";
    if (!title || (!(startKst && endKst) && !(legacyStartAt && legacyEndAt))) {
      return res.json({ ok: false, needs: "time", hint: "시간을 좀 더 구체적으로 알려주세요. 예: '오후 3시'" });
    }
    // KST 로컬 ISO ("YYYY-MM-DDTHH:MM:SS") → UTC ISO ("...000Z") 결정론적 변환.
    // KST = UTC + 9 → UTC = KST 시점에 +09:00 offset 표시 후 toISOString().
    const kstToUtc = (kstLocal) => {
      // 분 단위 누락 케이스 보정 ("...T15:00" → "...T15:00:00")
      const hasSec = /T\d{2}:\d{2}:\d{2}/.test(kstLocal);
      const normalized = hasSec ? kstLocal : `${kstLocal}:00`;
      const ms = new Date(`${normalized}+09:00`).getTime();
      if (Number.isNaN(ms)) return null;
      return new Date(ms).toISOString();
    };
    let startAt, endAt;
    if (startKst && endKst) {
      startAt = kstToUtc(startKst);
      endAt = kstToUtc(endKst);
    } else {
      startAt = legacyStartAt;
      endAt = legacyEndAt;
    }
    if (!startAt || !endAt) {
      return res.json({ ok: false, needs: "date", hint: "날짜·시각을 다시 알려주세요." });
    }
    // LLM 의 endKst 환각 (연도/시각 잘못 출력) 자동 보정 — endAt <= startAt 이면 시작 + 1시간.
    // 작은 모델 (e4b 등) 에서 가끔 "2022 종료" 같은 출력이 나와 backend 400 으로 떨어지는 케이스를 방지.
    let startMs = new Date(startAt).getTime();
    let endMs = new Date(endAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
      endAt = new Date(startMs + 60 * 60 * 1000).toISOString();
      endMs = new Date(endAt).getTime();
    }
    // LLM hour 환각 cross-check — 사용자 입력의 시각 단서가 있는데 LLM 출력 시각이 다르면
    // 사용자 값으로 보정. 작은 모델(e4b)이 "20시"를 "10시" 등으로 오인식하는 케이스 차단.
    // duration 은 유지. 날짜 부분은 LLM 추론(매핑 표 기반) 그대로 신뢰.
    const userTimeMatch = question.match(/(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
    if (userTimeMatch && Number.isFinite(startMs) && Number.isFinite(endMs)) {
      let userHour = parseInt(userTimeMatch[1], 10);
      const userMinute = userTimeMatch[2] ? parseInt(userTimeMatch[2], 10) : 0;
      const ampm = question.match(/(오전|오후|새벽|정오|자정)/)?.[1];
      if (ampm === "오후" && userHour >= 1 && userHour <= 11) userHour += 12;
      else if (ampm === "오전" && userHour === 12) userHour = 0;
      else if (ampm === "새벽" && userHour === 12) userHour = 0;
      const kstStart = new Date(startMs + 9 * 60 * 60 * 1000);
      const llmHour = kstStart.getUTCHours();
      const llmMin = kstStart.getUTCMinutes();
      if (userHour >= 0 && userHour <= 23 && (llmHour !== userHour || llmMin !== userMinute)) {
        const dur = endMs - startMs;
        kstStart.setUTCHours(userHour, userMinute, 0, 0);
        startMs = kstStart.getTime() - 9 * 60 * 60 * 1000;
        startAt = new Date(startMs).toISOString();
        endAt = new Date(startMs + dur).toISOString();
        endMs = startMs + dur;
      }
    }
    const args = { title, startAt, endAt, description };
    // 과거 시각 검증 — 무조건 미래만 허용. 1분 grace period.
    const startAtMs = new Date(args.startAt).getTime();
    if (Number.isNaN(startAtMs)) {
      return res.json({ ok: false, needs: "date", hint: "날짜·시각을 다시 알려주세요." });
    }
    const nowMs = new Date(now).getTime();
    if (startAtMs < nowMs - 60_000) {
      const kstStart = new Date(startAtMs + 9 * 60 * 60 * 1000);
      const kstStartStr = kstStart.toISOString().slice(0, 16).replace("T", " ");
      return res.json({
        ok: false,
        needs: "date",
        hint: `${kstStartStr} 은 이미 지난 시각이에요. 미래 날짜·시각으로 다시 알려주세요.`,
      });
    }
    // 시각 자동 채움 차단 — 사용자 입력에 시간 키워드 없으면 needs="time" 강제.
    const TIME_INDICATORS = /\d+\s*시|\d+\s*[:：]\s*\d+|정오|자정/;
    if (!TIME_INDICATORS.test(question)) {
      return res.json({
        ok: false,
        needs: "time",
        hint: "몇 시에 잡을까요?",
      });
    }
    // AM/PM 모호 시각 차단 — "1시"~"12시" 단독 입력 (오전/오후/정오/자정/새벽/24h 미명시) → 후속 질문.
    // 명확 시그널: 오전·오후·정오·자정·새벽 키워드 또는 13시 이상 24h 표기.
    const hasAmPmMarker = /(오전|오후|정오|자정|새벽)/.test(question);
    const has24hHour = /(1[3-9]|2[0-4])\s*시/.test(question);
    const hasBareHour = /\d+\s*시/.test(question);
    if (hasBareHour && !hasAmPmMarker && !has24hHour) {
      return res.json({
        ok: false,
        needs: "time",
        hint: "오전/오후 어느 쪽일까요? (예: '오후 1시')",
      });
    }
    return res.json({ ok: true, args });
  } catch (err) {
    return res.json({ ok: false, error: String(err.message || err) });
  }
});

// 일정 조회 자연어 → 조회 범위 파싱.
// 입력: { question, nowIso? }
// 출력: { ok:true, view: 'day'|'week'|'month', date: 'YYYY-MM-DD' } 또는 { ok:false, error, view:'month', date: 오늘 }
//   - 한국어 표현("4월 22일", "이번 주", "오늘", "다음 달") 을 LLM 으로 view+date 로 변환.
//   - LLM 이 KST 기준으로 해석. date 는 KST 날짜.
//   - 파싱 실패 시 default(view=month, date=오늘 KST) fallback.
app.post("/parse-schedule-query", async (req, res) => {
  const { question: rawQuestion, nowIso } = req.body ?? {};
  if (!rawQuestion || typeof rawQuestion !== "string") {
    return res.status(400).json({ error: "`question` (string) is required" });
  }
  // 한자 숫자 날짜 정규화 ("오월 사일" → "5월 4일") — LLM 부담 최소화.
  const question = normalizeKoreanDate(rawQuestion);
  const now = nowIso || new Date().toISOString();
  const kstNow = new Date(new Date(now).getTime() + 9 * 60 * 60 * 1000);
  const todayKst = kstNow.toISOString().slice(0, 10);
  const kstWeekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const kstWeekday = kstWeekdays[kstNow.getUTCDay()];
  // "Y일" 단독 일자 → 가장 가까운 미래 매핑 (LLM 환각 방지 — parseScheduleArgs 와 동일).
  const dayMappingTable = buildDayMappingTable(kstNow);

  const sysPrompt = `당신은 한국어 일정 조회 요청을 JSON 으로 변환합니다.\n현재 KST 날짜: ${todayKst} (${kstWeekday})\n사용자가 한국 시간대로 말한다고 가정.\n\n반드시 다음 JSON 만 출력 (마크다운 금지):\n{"view":"day","date":"YYYY-MM-DD","keyword":""}\n\nview 결정 규칙:\n- 특정 하루 (예: "오늘", "내일", "어제", "4월 22일", "지난 화요일") → "day"\n- **"(다음|이번|지난)주 + 요일" 패턴** (예: "다음주 수요일", "이번주 금요일", "지난주 화요일") → "day", date=정확히 그 요일의 날짜\n  - 예시 (오늘이 ${todayKst} ${kstWeekday} 기준):\n    "다음주 수요일" → view="day", date=다음주의 수요일 날짜\n    "이번주 금요일" → view="day", date=이번주의 금요일 날짜\n    "지난주 화요일" → view="day", date=지난주의 화요일 날짜\n  - 절대 view="week" 로 분류하지 말 것 — 요일이 명시되면 단일 날짜.\n- 특정 주간 (예: "이번 주", "다음 주", "지난주") → "week" (요일 없을 때만)\n- **"X월 Y일 주" / "X일 주" 패턴** (특정 날짜 + 주 — 그 날짜를 포함하는 주) → "week", date=그 날짜\n  - 예: "4월 15일 주" → view="week", date="2026-04-15"\n  - 예: "5월 1일 주 일정" → view="week", date="2026-05-01"\n  - 주의: "주" 다음에 "간" 이 오면 (주간) 별도 단어 — 이 규칙 미적용\n- 특정 월 또는 모호 (예: "이번 달", "5월", "최근 일정", 시점 명시 없는 키워드 검색) → "month"\n\n**"X을/를 Y로 옮겨/바꿔/수정" 패턴** (수정 의도의 single-shot 표현):\n- 첫 발화에 두 시점 단서가 있고 "을/를 ... 로/으로 옮겨/바꿔/변경/수정" 형태면 X 가 식별 대상, Y 는 새 값.\n- 이 식별 단계 응답에선 **X (앞 시점) 만 사용** 하고 Y 는 무시.\n- 예: "5월 8일 미팅을 5월 9일로 옮겨줘" → date="2026-05-08" (X), keyword="미팅" (Y 의 5/9 무시)\n- 예: "내일 회의를 모레 오후 3시로 변경" → date=내일 날짜, keyword="회의"\n\ndate 결정:\n- view=day 면 그 날짜 (YYYY-MM-DD).\n- view=week/month 면 해당 주/월 안의 임의 날짜 (예: 그 주 월요일, 그 달 1일).\n- "오늘" → ${todayKst}, "내일" → 오늘+1일, "어제" → 오늘-1일.\n- "X월 Y일" 연도 미명시 → 가장 가까운 미래 (오늘 이후의 X월 Y일).\n- **"Y일" (월 미명시, 단독 일자) → 아래 매핑 표 그대로 사용**. 절대 추론·계산 금지. 과거 날짜 출력 금지.\n  예: 오늘이 ${todayKst} 기준 "22일" → 매핑 표의 "22일" 행 그대로.\n- "어제/지난주/지난달" 같은 명시적 과거 표현이 있을 때만 과거 날짜 사용.\n- 키워드 검색만 있고 시점 명시 없으면 date=오늘.\n\n[Y일 단독 매핑 표 — 가장 가까운 미래]\n${dayMappingTable}\n\nkeyword 결정 규칙:\n- **금지 키워드 (절대 keyword 로 추출 금지)** — 메타 동사·너무 일반적인 단어:\n  - 조회 동사: "일정", "스케줄", "정리", "알려", "보여", "확인", "조회", "찾아", "있어", "있나", "어떤", "뭐", "무엇"\n  - 등록 동사: "등록", "추가", "만들", "잡아", "예약", "넣어", "생성"\n  - 삭제 동사: "삭제", "제거", "지워", "지운"\n  - 수정 동사: "수정", "변경", "바꿔", "옮겨", "옮기"\n  - 필드명: "제목", "시간", "시각", "색깔", "색상", "색", "설명", "메모"\n  - 양 한정사: "모두", "전체", "전부", "모든", "다"\n- **시점/시간 표현 (절대 keyword 로 추출 금지 — view/date 로 처리)**: "오늘", "내일", "어제", "이번주", "다음주", "지난주", "이번달", "오전", "오후", "아침", "점심", "저녁", "밤", "새벽", "X월", "X월 Y일", "X시", "X요일" 등.\n- **그 외 사용자가 입력한 모든 명사·구절은 keyword 로 추출.** 익숙치 않은 단어 ("고구마", "포스트잇", "백엔드", "운동", "면접", "발표" 등) 도 그대로 포함. 일정 제목에 들어갈 수 있는 단서면 무엇이든 keyword. 화이트리스트 없음.\n- 의심스러우면 **추출** (빈 문자열 X). 잘못된 keyword 라도 매치 0건이면 시스템이 자동 확장 fallback 처리.\n- 금지·시점 표현만 있고 일정 제목 단서가 없으면 그때만 빈 문자열.\n\n예시:\n- "지난주 일정 정리해줘" → keyword="" (모든 단어가 시점/금지)\n- "오늘 회의 있어?" → keyword="회의"\n- "이번주 고구마 일정" → keyword="고구마" (익숙치 않은 단어도 그대로)\n- "다음주 포스트잇 정리해줘" → keyword="포스트잇"\n- "이번주 백엔드 회의" → keyword="백엔드 회의"\n- "디자인 리뷰 일정 언제야?" → keyword="디자인 리뷰"\n- "킥오프 미팅 보여줘" → keyword="킥오프 미팅"\n- "이번 주 회의 일정" → keyword="회의"\n- "이번 주 일정" → keyword="" (일정 단독은 금지)\n- "어제 회의 수정" → keyword="회의" (수정은 금지 동사)\n- "회의 제목 변경해줘" → keyword="회의" (제목·변경은 금지)\n- "이번주 회의 모두 수정해줘" → keyword="회의" (모두·수정 금지)\n\n절대 JSON 외 다른 문자 출력 금지.`;

  try {
    const model = await resolveChatModel();
    const result = await chat(model, [
      { role: "system", content: sysPrompt },
      { role: "user", content: question },
    ], { temperature: 0.1, num_predict: 128 });
    const raw = result.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return res.json({ ok: false, error: "JSON 추출 실패", view: "month", date: todayKst });
    let parsed;
    try {
      parsed = JSON.parse(m[0]);
    } catch (e) {
      return res.json({ ok: false, error: `JSON 파싱 실패: ${e.message}`, view: "month", date: todayKst });
    }
    const view = ["day", "week", "month"].includes(parsed.view) ? parsed.view : "month";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayKst;
    const keyword = typeof parsed.keyword === "string" ? parsed.keyword.trim() : "";
    return res.json({ ok: true, view, date, keyword });
  } catch (err) {
    return res.json({ ok: false, error: String(err.message || err), view: "month", date: todayKst });
  }
});

app.post("/chat", async (req, res) => {
  const { question, topK, stream } = req.body ?? {};
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "`question` (string) is required" });
  }
  try {
    const k = Number.isFinite(topK) ? Math.max(1, Math.min(10, topK)) : TOP_K;
    const retrieved = await retrieve(question, k);
    const messages = await buildMessages(question, retrieved);
    const model = await resolveChatModel();
    const sources = retrieved.map((r) => ({
      source_file: r.chunk.source_file,
      section_path: r.chunk.section_path,
      parent_id: r.parent_id,
      score: Number(r.score.toFixed(4)),
      cos: Number((r.cos ?? 0).toFixed(4)),
      bm25: Number((r.bm25 ?? 0).toFixed(4)),
    }));

    // === Streaming 모드 — SSE 로 토큰 단위 forward ===
    if (stream === true) {
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      // 출처는 시작 시점에 한 번에 전송 (사용자 UI 가 placeholder 로 미리 표시)
      res.write(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`);

      const upstream = await chatStreamRaw(model, messages, { temperature: 0.3 });
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try {
            const obj = JSON.parse(t);
            const tok = obj.message?.content;
            if (tok) {
              res.write(`data: ${JSON.stringify({ type: "token", text: tok })}\n\n`);
            }
            if (obj.done) {
              res.write(`data: [DONE]\n\n`);
            }
          } catch {
            // ndjson 파싱 실패한 라인은 스킵
          }
        }
      }
      res.end();
      return;
    }

    // === 기존 non-stream 모드 ===
    const result = await chat(model, messages, { temperature: 0.3 });
    res.json({ answer: result.message?.content ?? "", sources });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: String(err.message || err) });
    } else {
      res.write(`data: ${JSON.stringify({ type: "error", message: String(err.message || err) })}\n\n`);
      res.end();
    }
  }
});

app.listen(SERVER_PORT, () => {
  console.log(`RAG server listening on http://127.0.0.1:${SERVER_PORT}`);
  console.log(`  POST /chat       { "question": "..." }`);
  console.log(`  POST /classify   { "question": "..." }    4-way 의도 분류기`);
  console.log(`  POST /parse-schedule-args { "question": "..." }    일정 등록 자연어 → 인자 파싱`);
  console.log(`  POST /parse-schedule-query { "question": "..." }    일정 조회 자연어 → view+date 파싱`);
  console.log(`  GET  /health`);
});
