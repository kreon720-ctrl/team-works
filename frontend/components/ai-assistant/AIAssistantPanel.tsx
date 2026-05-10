'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getValidAccessToken } from '@/lib/authInterceptor';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface Source {
  // RAG 결과 (TEAM WORKS 공식 문서)
  source_file?: string;
  section_path?: string;
  score?: number;
  // Open WebUI 웹 검색 결과
  title?: string;
  url?: string;
  // 일정(schedule) 결과 — startAt/endAt 은 ISO 8601
  startAt?: string;
  endAt?: string;
}

type AnswerSource = 'rag' | 'web' | 'schedule' | 'blocked';

interface PendingAction {
  tool: string;
  args: Record<string, unknown>;
}

// schedule_update multi-step 진행 상태 — 채팅 핸들러가 carry, 매 turn 마다 chat route 에 동봉 전송.
// stateless 한 chat route 가 step 간 정보 (target schedule + 누적 새 값) 를 받기 위함.
interface UpdateState {
  needs: 'new-datetime' | 'new-title';
  targetScheduleId: string;
  targetTitle: string;
  targetStartAt: string;
  targetEndAt: string;
  newStartAt?: string;
  newEndAt?: string;
  newTitle?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error' | 'system';
  content: string;
  sources?: Source[];
  // 답변 출처 — 'rag'(TEAM WORKS 공식 문서) 또는 'web'(Open WebUI 웹검색)
  answerSource?: AnswerSource;
  // 분류 의도 — schedule 뱃지에서 조회/등록 구분 표시용
  intent?: string;
  pendingAction?: PendingAction;
  preview?: string;
  // Once the user confirms or cancels, we flip this so the card stops
  // rendering its action buttons.
  actionResolved?: 'confirmed' | 'cancelled';
  // 다중 턴 일정 등록·삭제·수정 — 직전 user 질문이 정보 부족이라 후속 답변을 기다리는 상태.
  // 다음 user 입력이 들어오면 previousQuestion 과 합쳐 (또는 updateState 와 함께) 재요청.
  awaitingInput?: {
    needs: string;
    previousQuestion: string;
    updateState?: UpdateState;
  };
}

// 단일 진입점 — 6개 의도(usage·general·query·create·delete·update) 대표 예시 1개씩.
const EXAMPLE_QUESTIONS = [
  '오늘 일정 알려줘',
  '내일 오후 3시 주간회의 등록해줘',
  '내일 회의 삭제해줘',
  '내일 회의 수정해줘',
  '포스트잇 색깔 종류 알려줘',
  '오늘 뉴스 검색해줘',
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 스트리밍 첫 토큰 도착 전까지 보일 placeholder. 실제 토큰이 들어오면 swap 됨.
const THINKING_PLACEHOLDER = 'Thinking...';

// content 가 placeholder 상태인지 판정. progress(🔎)·Thinking·완전 빈 문자열 모두 placeholder.
function isPlaceholderContent(content: string): boolean {
  if (!content) return true;
  if (content === THINKING_PLACEHOLDER) return true;
  if (content.startsWith('🔎')) return true;
  return false;
}

// 다중 턴 일정 등록·삭제 — needs 별로 보충 답변을 직전 질문에 병합해 한 줄로 재구성.
// LLM 에 "X\n그리고 Y" 형태로 던지면 작은 모델일수록 두 절을 별개로 읽어 재차 같은 질문을
// 반복하거나 JSON 추출에 실패함. 결정론적 정규식 병합으로 LLM 부담 제거.
//
// fallback (정규식이 매치 못 함): 옛 "그리고" 포맷 유지 — 정보 손실 없음.
const AMPM_RE = /(오전|오후|정오|자정|새벽)/;
const HOUR_RE = /\d+\s*시/;
// 약식 도트·슬래시 표기 ("5.4. 주", "5/4 주", "5.4") 도 포함 — 한국 약식 표기 흔함.
// 모든 날짜 패턴은 끝의 선택적 "주" 까지 한 단위로 매치해야 분기 3 (date-replace) 에서
// 주 단위 단서 ("5월 4일 주", "5.4.주") 를 보충("5일") 로 한 번에 교체 가능 (잔존 "주" 방지).
const DATE_HINT_RE = /(오늘|내일|어제|모레|글피|\d+월\s*\d+일\s*주?|\d+일\s*주?|월요일|화요일|수요일|목요일|금요일|토요일|일요일|이번\s*주|다음\s*주|지난\s*주|\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*주?|\d{1,2}\s*\/\s*\d{1,2}\s*주?)/;
// schedule_delete 다중 후보 보충 입력 처리용 — 보충이 자체 완결 schedule 질문인지 판정.
// 둘 다 매치하면 그대로 새 질문으로 사용 (예: "15일 일정 삭제").
const SELF_CONTAINED_NOUN_RE = /(일정|회의|미팅|약속|스케줄)/;
const SELF_CONTAINED_VERB_END_RE = /(등록|추가|만들|잡아|예약|넣어|생성|삭제|제거|지워|지운)\s*(해줘|해|줘)?\s*$/;
// 다중 후보 좁히기 단계에서 사용자가 "전체/모두/전부/모든/다 삭제" 같이 일괄 삭제를 시도하는지 판정.
// 매치되면 안내 후 awaiting-input 상태 유지 — 의도치 않은 대량 삭제 차단.
// "다섯/다른" 같은 합성어는 `다\s*(?:삭제|...)` 형태로만 잡아 false positive 회피.
const BULK_DELETE_INTENT_RE = /(전체|모두|전부|모든|다\s*(?:삭제|지워|지운|제거))/;
// 직전 질문이 schedule_delete 의도였는지 판정 — needs:'title' 은 create 도 사용하므로 분기 구분용.
const DELETE_INTENT_IN_PREV_RE = /(삭제|지워|지운|제거)/;
// supplement="2일" 단독 보충 + prev에 "X월" 단독 (뒤에 숫자 없음) → "X월 Y일" 로 결합용.
// 예: prev="5월 점심일정 삭제해줘" + supplement="2일" → "5월 2일 점심일정 삭제해줘"
const DAY_ONLY_SUPPLEMENT_RE = /^(\d{1,2})\s*일\s*$/;
const MONTH_ONLY_IN_PREV_RE = /(\d{1,2})\s*월(?!\s*\d)/;
// 사용자 입력이 명백한 새 schedule 요청인지 판정 — schedule 동사 포함.
// awaiting-input 중에 새 요청이 들어오면 직전 대기 상태(updateState 등) 를 무시하고
// fresh classification 으로 진행. 단순 보충 입력엔 이 동사들 없음.
// rag/server.js 의 SCHEDULE_*_VERBS / 조회 동사와 의미상 일치하도록 모두 포함.
const FRESH_SCHEDULE_REQUEST_RE = /(수정|변경|바꿔|옮겨|옮기|삭제|제거|지워|지운|등록|추가|만들|잡아|예약|넣어|생성|보여|알려|확인|조회|찾아|정리)/;
// schedule_update multi-step 답변 패턴 — "(으)로/라고 + 동사" 형태는 새 값 명시 답변이지
// 새 schedule 요청이 아님. 예: "저녁 고객미팅으로 바꿔줘" → 새 제목 명시 (FRESH 우회 대상).
// chat route 의 NEW_TITLE_TRAILING_RE 와 의미상 동일 — 동사 부분이 있어야 매치.
const NEW_VALUE_HINT_RE = /(?:으로|로|라고)\s*(?:변경|바꿔|수정|이동|넣어|입력|부탁|해|줘)/;

function rebuildFollowUpQuestion(
  prev: string,
  needs: string,
  supplement: string,
): string {
  const fallback = `${prev}\n그리고 ${supplement}`;
  if (needs === 'datetime') {
    // schedule_create 통합 묻기 ("일시는 언제로 할까요?") 의 보충 답변.
    // 보충에 날짜·시각 어떤 조합이 와도 prev 끝에 단순 결합 — LLM 이 다음 턴에 다시 분석해
    // 부족분(time/date) 만 후속 질문하거나 ok 로 confirm 진행.
    return `${prev} ${supplement}`;
  }
  if (needs === 'time') {
    // 사용자가 prev 와 무관한 datetime 풀세트("9일 20시")로 다시 답한 케이스 — 결합하면 모순.
    // 거절 응답 후 사용자가 시각만 보충하는 게 아니라 새 일시를 통째로 알려주는 흐름 보호.
    if (DATE_HINT_RE.test(supplement) && HOUR_RE.test(supplement)) return supplement;
    const ampm = supplement.match(AMPM_RE)?.[1];
    const hourInSupplement = supplement.match(/(\d+)\s*시/)?.[1];
    // 보충에 시각 전체 ("오후 3시") → prev 의 시각 부분을 통째 교체
    if (ampm && hourInSupplement) {
      if (HOUR_RE.test(prev)) return prev.replace(HOUR_RE, `${ampm} ${hourInSupplement}시`);
      // prev 에 시각 없으면 끝에 추가
      return `${prev} ${ampm} ${hourInSupplement}시`;
    }
    // 보충에 AM/PM 만 ("오후") → prev 의 "N시" 앞에 삽입
    if (ampm && HOUR_RE.test(prev) && !AMPM_RE.test(prev)) {
      return prev.replace(HOUR_RE, (hr) => `${ampm} ${hr}`);
    }
    // 보충에 "N시" 만 ("3시", "13시") → prev 끝에 시각 추가 (시각이 prev 에 없을 때)
    if (hourInSupplement && !HOUR_RE.test(prev)) {
      return `${prev} ${hourInSupplement}시`;
    }
  }
  if (needs === 'date') {
    // 자체완결 datetime ("9일 20시") → prev 무시하고 supplement 만. (needs='time' 분기 가드와 동일 사유)
    if (DATE_HINT_RE.test(supplement) && HOUR_RE.test(supplement)) return supplement;
    // 보충에 날짜 단서 ("내일", "5월 8일", "월요일" 등) → prev 앞에 prepend
    if (DATE_HINT_RE.test(supplement)) return `${supplement} ${prev}`;
  }
  if (needs === 'title') {
    // 1) 보충이 자체 완결된 schedule 질문이면 (명사 + 동사 모두 포함) prev 무시하고 그대로 사용.
    //    예: prev="다음주 점심일정 삭제", supplement="15일 일정 삭제" → "15일 일정 삭제"
    //    이중 동사·날짜 충돌 (다음주+15일+삭제 두 번) 방지.
    if (SELF_CONTAINED_NOUN_RE.test(supplement) && SELF_CONTAINED_VERB_END_RE.test(supplement)) {
      return supplement;
    }
    // 2) 보충="X일" 단독 → 단서 위치를 LLM 이 specific day 로 인식하도록 보정.
    //    LLM 은 "X일" 같은 시점 단서가 앞쪽에 있을수록 day 로 정확히 분류 — 단어 순서 민감.
    //    2a) prev 에 월(月) 만 있고 일(日) 없음 → "X월 Y일" 로 결합.
    //        예: "5월 점심일정 삭제해줘" + "2일" → "5월 2일 점심일정 삭제해줘"
    //    2b) prev 에 어떤 시점 단서도 없음 → supplement 를 prev 앞에 prepend.
    //        예: "전체 회의 일정 삭제해줘" + "5일" → "5일 전체 회의 일정 삭제해줘"
    //        동사 직전 insert 시 "전체" 같은 month 시그널이 먼저 읽혀 view=month 환각 회피.
    //    prev 에 다른 시점 단서 (다음주, X월 Y일 등) 가 있으면 prepend 시 LLM 이 두 단서를
    //    혼합 해석할 수 있어 (예: "15일 다음주" → 5/16 으로 오해석) 분기 4 (date-replace) 로 위임.
    const dayOnly = supplement.match(DAY_ONLY_SUPPLEMENT_RE);
    const monthOnly = prev.match(MONTH_ONLY_IN_PREV_RE);
    if (dayOnly) {
      if (monthOnly) {
        return prev.replace(monthOnly[0], `${monthOnly[1]}월 ${dayOnly[1]}일`);
      }
      if (!DATE_HINT_RE.test(prev)) {
        return `${supplement} ${prev}`;
      }
      // prev 에 시점 단서가 있으면 분기 3 (date-replace) 로 fall-through.
    }
    // 3) 보충에 날짜 단서만 있으면 prev 의 날짜 부분을 교체 (날짜 좁히기 의도).
    //    예: prev="다음주 점심일정 삭제", supplement="15일" → "15일 점심일정 삭제"
    if (DATE_HINT_RE.test(supplement) && DATE_HINT_RE.test(prev)) {
      return prev.replace(DATE_HINT_RE, supplement);
    }
    // 4) 그 외 (제목/키워드 단서) — prev 의 동사 앞에 삽입.
    //    예: prev="내일 회의 삭제해줘" + "고객미팅" → "내일 회의 고객미팅 삭제해줘"
    const verbMatch = prev.match(SELF_CONTAINED_VERB_END_RE);
    if (verbMatch) {
      const idx = verbMatch.index ?? prev.length;
      return `${prev.slice(0, idx).trimEnd()} ${supplement} ${prev.slice(idx)}`;
    }
    return `${prev} ${supplement}`;
  }
  return fallback;
}

interface AIAssistantPanelProps {
  teamId: string;
  teamName: string;
  // 팀 페이지 우측 탭 안에 임베드될 땐 헤더가 탭에 흡수되어 false. 직접 URL(/ai-assistant?...) fallback 일 땐 true.
  showHeader?: boolean;
  // 일정 아이콘(전송 버튼 아래) 클릭 시 호출되는 콜백. 미전달 시 아이콘 자체를 렌더하지 않음.
  // 부모(MobileLayout 등)에서 split view 상태 토글에 사용.
  onToggleCalendar?: () => void;
  // split view 활성 여부 — 아이콘 시각 강조에 사용 (선택).
  calendarSplitActive?: boolean;
  // 음성 입력(STT) 마이크 아이콘 노출 — true 일 때만 렌더. 모바일 컨텍스트에서 부모가 전달.
  // 비지원 브라우저(SpeechRecognition 미지원)는 자체적으로 hide.
  enableVoiceInput?: boolean;
}

export function AIAssistantPanel({ teamId, teamName, showHeader = false, onToggleCalendar, calendarSplitActive = false, enableVoiceInput = false }: AIAssistantPanelProps) {
  const queryClient = useQueryClient();
  const userHint = useMemo(() => {
    if (!teamId) return undefined;
    return `현재 사용자가 선택한 기본 팀: "${teamName}" (teamId=${teamId}). 사용자가 별도의 팀을 지정하지 않으면 이 팀을 대상으로 조회/등록/삭제/수정하세요.`;
  }, [teamId, teamName]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '안녕하세요! AI 버틀러 찰떡입니다.\n팀웍스 사용법(📚 공식 문서)·일반 질문(🌐 웹 검색)·우리 팀 일정 조회·등록·삭제·수정(📅) 모두 자유롭게 물어봐 주세요. 시스템이 자동으로 적절한 경로로 답변합니다.\n(프로젝트·채팅 작업은 화면에서 직접 처리해 주세요.)',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // SSE meta 의 model 필드 — 직전 답변에 쓰인 모델명. 푸터 표시용.
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // STT (음성 입력) — 모바일 컨텍스트(enableVoiceInput=true) 에서만 활성.
  // hook 자체는 항상 호출 (Rules of Hooks). 비지원 브라우저는 isSupported=false 로 자체 차단.
  const stt = useSpeechRecognition();

  // 음성 인식 결과(transcript) 가 들어올 때마다 입력창에 반영.
  // 빈 문자열일 때는 sync 하지 않음 (사용자가 키보드로 입력 중일 가능성).
  useEffect(() => {
    if (stt.transcript) setInput(stt.transcript);
  }, [stt.transcript]);

  // STT 오류는 채팅 영역에 error 메시지로 노출 (기존 error 메시지 패턴 재사용).
  useEffect(() => {
    if (!stt.error) return;
    setMessages(prev => [...prev, { id: newId(), role: 'error', content: stt.error! }]);
  }, [stt.error]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    // 다중 턴 — 직전 assistant 메시지가 awaitingInput 이면 두 turn 을 합쳐 재요청.
    // (서버는 stateless — 합친 한 question 으로 새 parse 시도.)
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    let pendingTurn = lastAssistant?.awaitingInput;

    // Fresh-request 가드 — pendingTurn 이 있어도 사용자가 명백히 새 schedule 요청을 보냈으면 무시.
    // 예: schedule_update 의 new-datetime 대기 중에 사용자가 "8일 회의 수정해줘" 같은 새 요청을 보내면
    // 직전 updateState 가 carry 되어 multi-step 으로 잘못 라우팅됨 ("몇 시에 잡을까요?" 같은 환각).
    // schedule 동사 (수정/삭제/등록 등) 가 supplement 에 있으면 명백히 새 요청으로 간주.
    // (단순 시점·제목 보충 입력엔 이런 동사 없음 — 예: "오후", "정기회의", "15시", "그대로")
    //
    // 예외: multi-step (new-datetime/new-title) 답변에서 "(으)로/라고 + 동사" 패턴이면
    // 새 값 명시 답변으로 간주 — FRESH 매치돼도 우회. 예: "저녁 고객미팅으로 바꿔줘" 는
    // 새 제목 명시이지 새 schedule 요청이 아님.
    if (pendingTurn && FRESH_SCHEDULE_REQUEST_RE.test(trimmed)) {
      const isMultiStepAnswer =
        (pendingTurn.needs === 'new-title' || pendingTurn.needs === 'new-datetime') &&
        NEW_VALUE_HINT_RE.test(trimmed);
      // 예외 2: schedule_delete 의 title 단계에서 "모두/전체 삭제" 류 일괄 삭제 시도.
      // FRESH 가 "삭제" 동사를 잡아 pendingTurn 을 clear 하면 아래 BULK 가드가 못 동작 →
      // 사용자 입력이 fresh classification 으로 빠져 의도와 다른 응답(웹검색 등) 나옴.
      const isBulkDeleteFollowUp =
        pendingTurn.needs === 'title' &&
        DELETE_INTENT_IN_PREV_RE.test(pendingTurn.previousQuestion) &&
        BULK_DELETE_INTENT_RE.test(trimmed);
      if (!isMultiStepAnswer && !isBulkDeleteFollowUp) {
        pendingTurn = undefined;
      }
    }

    // 벌크 삭제 가드 — 다중 후보 좁히기(needs:'title') + 직전이 삭제 의도일 때만.
    // "전체 일정 삭제" 같이 일괄 삭제 시도 시 안내 후 awaiting-input 상태 유지.
    // 서버 호출 안 함 — 의도치 않은 대량 삭제 가능성 자체를 차단.
    if (
      pendingTurn?.needs === 'title' &&
      DELETE_INTENT_IN_PREV_RE.test(pendingTurn.previousQuestion) &&
      BULK_DELETE_INTENT_RE.test(trimmed)
    ) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', content: trimmed },
        {
          id: newId(),
          role: 'assistant',
          content: '한 번에 한 가지 일정만 삭제할 수 있어요. 삭제할 일정의 제목이나 시각을 더 구체적으로 알려주세요.',
          awaitingInput: {
            needs: 'title',
            previousQuestion: pendingTurn.previousQuestion,
          },
        },
      ]);
      setInput('');
      // 음성 입력 잔여 정리 — 진행 중인 STT 세션 종료 + transcript reset
      // (이전 명령이 다음 세션에 누적되는 문제 차단)
      if (stt.isListening) stt.stop();
      stt.reset();
      return;
    }

    // schedule_update multi-step 분기:
    //  - skipCombine: needs='new-datetime'|'new-title' — 사용자가 새 값 전체를 그대로 입력 → 결합 없이 전송
    //  - clarify: needs='time'|'date'|'title' + updateState — parseScheduleArgs 가 부족분 다시 묻는 중
    //    → rebuildFollowUpQuestion 으로 직전 입력과 결합 후 updateState 동봉해 chat route 의
    //    new-datetime 단계로 재진입 (예: "다음주 수요일 2시" + "오후" → "다음주 수요일 오후 2시")
    const updateStateCarry = pendingTurn?.updateState;
    const skipCombine =
      !!updateStateCarry &&
      !!pendingTurn &&
      (pendingTurn.needs === 'new-datetime' || pendingTurn.needs === 'new-title');
    const effectiveQuestion = skipCombine
      ? trimmed
      : pendingTurn
      ? rebuildFollowUpQuestion(pendingTurn.previousQuestion, pendingTurn.needs, trimmed)
      : trimmed;

    // 사용자 화면에는 사용자가 입력한 그대로 표시.
    const userMsg: Message = { id: newId(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    // 음성 입력 잔여 정리 — 진행 중인 STT 세션 종료 + transcript reset
    // (이전 명령이 다음 세션에 누적되는 문제 차단)
    if (stt.isListening) stt.stop();
    stt.reset();
    setIsLoading(true);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      // 일정 조회·등록 의도는 서버에서 JWT 강제. 토큰이 있으면 항상 동봉해 backend 권한 검증을 거치게 함.
      // exp 30 초 이내면 미리 refresh — 15분 idle 후 첫 질문에서 backend 401 로 떨어지는 케이스 회피.
      const token = await getValidAccessToken();
      if (token) headers['authorization'] = `Bearer ${token}`;

      // 모든 의도를 SSE 로 처리 — token / pending-action / blocked 모두 stream 안에서 분기.
      const useStream = true;

      const res = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: effectiveQuestion,
          teamId,
          teamName,
          userHint,
          stream: useStream,
          // schedule_update multi-step state — skipCombine (새 값 직접 입력) +
          // clarify (time/date 보충) 양쪽 모두 carry 해서 chat route 가 단계별로 처리.
          updateState: updateStateCarry,
        }),
      });

      if (!res.ok) {
        // 에러는 JSON 으로 옴 (stream 시작 전)
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `요청 실패 (${res.status})`);
      }

      // === SSE stream — 모든 의도(usage / general / schedule_query / schedule_create / blocked) ===
      const msgId = newId();
      // placeholder 메시지 추가. 첫 실제 토큰 도착 시 swap.
      setMessages((prev) => [
        ...prev,
        { id: msgId, role: 'assistant', content: THINKING_PLACEHOLDER },
      ]);

      if (!res.body) throw new Error('스트림 응답을 받지 못했습니다.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamError: string | null = null;

      // SSE meta 의 source(rag/web/schedule/blocked)를 메시지의 answerSource 로 매핑.
      const mapSource = (s: unknown): AnswerSource | undefined => {
        if (s === 'rag' || s === 'web' || s === 'schedule' || s === 'blocked') return s;
        return undefined;
      };

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
            const evt = JSON.parse(data);
            if (evt.type === 'meta') {
              const intent =
                evt.classification && typeof evt.classification.intent === 'string'
                  ? evt.classification.intent
                  : undefined;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? { ...m, answerSource: mapSource(evt.source), intent }
                    : m
                )
              );
              if (typeof evt.model === 'string' && evt.model) {
                setActiveModel(evt.model);
              }
            } else if (evt.type === 'progress' && typeof evt.text === 'string') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId && isPlaceholderContent(m.content)
                    ? { ...m, content: evt.text }
                    : m
                )
              );
            } else if (evt.type === 'token' && typeof evt.text === 'string') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== msgId) return m;
                  const swap = isPlaceholderContent(m.content);
                  return {
                    ...m,
                    content: swap ? evt.text : m.content + evt.text,
                  };
                })
              );
            } else if (evt.type === 'sources' && Array.isArray(evt.sources)) {
              setMessages((prev) =>
                prev.map((m) => (m.id === msgId ? { ...m, sources: evt.sources } : m))
              );
            } else if (evt.type === 'awaiting-input' && typeof evt.previousQuestion === 'string') {
              // 다중 턴 — 정보 부족. 다음 user 입력에서 합쳐 (또는 updateState 와 함께) 재요청.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        awaitingInput: {
                          needs: typeof evt.needs === 'string' ? evt.needs : 'unknown',
                          previousQuestion: evt.previousQuestion,
                          updateState:
                            evt.updateState && typeof evt.updateState === 'object'
                              ? (evt.updateState as UpdateState)
                              : undefined,
                        },
                      }
                    : m
                )
              );
            } else if (evt.type === 'pending-action' && evt.pendingAction) {
              // schedule_create — 사용자 승인 카드. content 는 evt.text(요약), pendingAction 부착.
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        content:
                          typeof evt.text === 'string' && evt.text
                            ? evt.text
                            : '아래 내용으로 일정 등록할까요?',
                        pendingAction: evt.pendingAction,
                        preview: evt.preview,
                      }
                    : m
                )
              );
            } else if (evt.type === 'error') {
              streamError = String(evt.message || '스트림 오류');
            }
          } catch {
            // JSON 파싱 실패 라인 무시
          }
        }
      }

      if (streamError) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, role: 'error', content: streamError! } : m
          )
        );
      } else {
        // content 가 placeholder 인 채로 끝났으면 안내 문구로 교체.
        // 단 pendingAction 이 부착되어 있으면 content 가 placeholder 라도 그대로 둠 (confirm 카드).
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId &&
            !m.pendingAction &&
            (isPlaceholderContent(m.content) || !m.content.trim())
              ? { ...m, content: '(빈 응답)' }
              : m
          )
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'error', content: message },
      ]);
    } finally {
      setIsLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function confirmPendingAction(msgId: string) {
    const target = messages.find((m) => m.id === msgId);
    if (!target?.pendingAction || target.actionResolved) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionResolved: 'confirmed' } : m))
    );
    setIsLoading(true);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      const res = await fetch('/api/ai-assistant/execute', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(target.pendingAction),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `실행 실패 (${res.status})`);
      // 일정 등록·삭제·수정 후 좌측 캘린더 자동 갱신 — 모든 schedules 쿼리(view×date 조합) 무효화.
      const tool = target.pendingAction.tool;
      if (
        (tool === 'createSchedule' || tool === 'deleteSchedule' || tool === 'updateSchedule') &&
        teamId
      ) {
        queryClient.invalidateQueries({ queryKey: ['schedules', teamId] });
      }
      const doneMsg =
        tool === 'deleteSchedule'
          ? '삭제했어요. 캘린더에 반영됐어요. ✓'
          : tool === 'updateSchedule'
          ? '수정했어요. 캘린더에 반영됐어요. ✓'
          : '완료했어요. 캘린더에 반영됐어요. ✓';
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: doneMsg,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'error', content: message },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function cancelPendingAction(msgId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionResolved: 'cancelled' } : m))
    );
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'system', content: '실행을 취소했어요.' },
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendQuestion(input);
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-base">
      {/* Header — 탭 임베드 시 비표시(showHeader=false), 직접 URL fallback 시 표시 */}
      {showHeader && (
        <header className="flex items-center justify-center gap-2 h-14 px-4 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-elevated text-gray-900 dark:text-[#FFB800] shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="6" x2="12" y2="3" />
              <circle cx="12" cy="2.5" r="0.8" fill="currentColor" stroke="none" />
              <rect x="5" y="6" width="14" height="11" rx="2" />
              <circle cx="9" cy="11" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15" cy="11" r="1.2" fill="currentColor" stroke="none" />
              <path d="M9 14.5h6" strokeLinecap="round" />
              <path d="M5 11H3M19 11h2" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <h1 className="text-base font-semibold text-gray-900 dark:text-[#FFB800]">AI 버틀러 찰떡이</h1>
            {teamName ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-[#FFB800]/15 dark:text-[#FFB800]">
                {teamName}
              </span>
            ) : (
              <span className="text-xs text-gray-400 dark:text-dark-text-disabled">TEAM WORKS</span>
            )}
          </div>
        </header>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onConfirm={() => confirmPendingAction(msg.id)}
            onCancel={() => cancelPendingAction(msg.id)}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-dark-text-disabled animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-dark-text-disabled animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-dark-text-disabled animate-bounce" />
            </span>
            <span>답변 생성 중…</span>
          </div>
        )}

        {messages.length <= 1 && !isLoading && (
          <div className="pt-2">
            <p className="text-xs font-medium text-gray-500 dark:text-dark-text-muted mb-2">예시 질문</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text-muted hover:border-primary-300 dark:hover:border-dark-accent hover:text-primary-700 dark:hover:text-dark-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 pt-3 pb-3 shrink-0">
        <div className="flex items-stretch gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="사용법·일반 질문·우리 팀 일정 조회·등록 모두 자유롭게 물어보세요. (Enter 전송, Shift+Enter 줄바꿈)"
            className="flex-1 resize-none max-h-56 min-h-[88px] rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-base px-4 py-2.5 text-sm font-normal text-gray-800 dark:text-dark-text leading-relaxed shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-dark-accent focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-dark-text-disabled transition-colors duration-150 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed dark:disabled:bg-dark-elevated dark:disabled:border-dark-border dark:disabled:text-dark-text-disabled"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1.5 self-start">
            <button
              type="button"
              onClick={() => sendQuestion(input)}
              disabled={!input.trim() || isLoading}
              className="inline-flex items-center justify-center gap-1 rounded-lg py-[9px] px-3 text-xs font-medium transition-colors duration-150 bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed dark:bg-dark-accent-strong dark:text-gray-900 dark:hover:bg-white dark:disabled:bg-dark-elevated dark:disabled:text-dark-text-disabled"
            >
              {isLoading ? (
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : '전송'}
            </button>
            {enableVoiceInput && stt.isSupported && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={stt.isListening ? stt.stop : stt.start}
                  disabled={stt.isTranscribing || isLoading}
                  className={`inline-flex items-center justify-center w-full rounded-lg py-1.5 px-3 transition-colors duration-150 ${
                    stt.isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : stt.isTranscribing
                        ? 'bg-amber-400 text-white cursor-wait'
                        : isLoading
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-elevated dark:text-dark-text-disabled'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-elevated'
                  }`}
                  aria-label={stt.isListening ? '음성 입력 중지' : stt.isTranscribing ? '음성 변환 중' : isLoading ? '응답 대기 중' : '음성 입력 시작'}
                  aria-pressed={stt.isListening}
                  aria-busy={stt.isTranscribing || isLoading}
                >
                  {stt.isTranscribing ? (
                    // 변환 중 스피너
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    // heroicons microphone
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
                    </svg>
                  )}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  {stt.isListening ? '음성 입력 중지' : stt.isTranscribing ? '음성 변환 중...' : isLoading ? '응답 대기 중' : '음성 입력 시작'}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
                </div>
              </div>
            )}
            {onToggleCalendar && (
              <div className="relative group">
                <button
                  type="button"
                  onClick={onToggleCalendar}
                  className={`inline-flex items-center justify-center w-full rounded-lg py-1.5 px-3 transition-colors duration-150 ${
                    calendarSplitActive
                      ? 'bg-primary-500 text-white hover:bg-primary-600 dark:bg-dark-accent-strong dark:text-gray-900'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-elevated'
                  }`}
                  aria-label="일정화면 보기"
                  aria-pressed={calendarSplitActive}
                >
                  {/* 캘린더 아이콘 — heroicons calendar */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  일정화면 보기
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-dark-text-disabled text-center">
          Answered by {activeModel ?? 'AI'} · 사용법은 공식 문서, 일정은 팀 DB, 그 외엔 웹 검색으로 답해요.
        </p>
      </div>
    </div>
  );
}

// 답변 카드 하단의 출처 뱃지 — RAG(공식 문서) vs Web(웹검색) 색상·아이콘 분리
function SourceBadge({
  source,
  sources,
  intent,
}: {
  source: AnswerSource;
  sources: Source[];
  intent?: string;
}) {
  if (source === 'rag') {
    if (sources.length === 0) {
      return (
        <p className="text-[11px] text-amber-700 dark:text-[#FFB800] pl-1">
          📚 TEAM WORKS 공식 문서 기반
        </p>
      );
    }
    return (
      <details className="text-xs text-amber-800 dark:text-[#FFB800] pl-1">
        <summary className="cursor-pointer hover:text-amber-900 dark:hover:text-amber-300 select-none">
          📚 TEAM WORKS 공식 문서 {sources.length}건 참조
        </summary>
        <ul className="mt-1.5 space-y-0.5 pl-3">
          {sources.map((s, i) => (
            <li key={i} className="flex gap-2 text-gray-600 dark:text-dark-text-muted">
              {typeof s.score === 'number' && (
                <span className="tabular-nums text-gray-400 dark:text-dark-text-disabled">
                  {s.score.toFixed(2)}
                </span>
              )}
              <span className="truncate">
                <span>{s.source_file}</span>
                <span className="text-gray-400 dark:text-dark-text-disabled"> :: </span>
                <span className="text-gray-700 dark:text-dark-text">{s.section_path}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  if (source === 'schedule') {
    const label =
      intent === 'schedule_create' ? '일정 등록' : '일정 조회';
    return (
      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-1">
        📅 {label}
      </p>
    );
  }

  if (source === 'blocked') {
    return (
      <p className="text-[11px] text-gray-500 dark:text-dark-text-muted pl-1">
        🚫 지원하지 않는 요청
      </p>
    );
  }

  // source === 'web'
  if (sources.length === 0) {
    return (
      <p className="text-[11px] text-blue-700 dark:text-blue-400 pl-1">
        🌐 웹 검색 기반
      </p>
    );
  }
  return (
    <details className="text-xs text-blue-700 dark:text-blue-400 pl-1">
      <summary className="cursor-pointer hover:text-blue-900 dark:hover:text-blue-300 select-none">
        🌐 웹 검색 {sources.length}건 참조
      </summary>
      <ul className="mt-1.5 space-y-0.5 pl-3">
        {sources.map((s, i) => (
          <li key={i} className="truncate">
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-400 hover:underline"
              >
                {s.title || s.url}
              </a>
            ) : (
              <span className="text-gray-600 dark:text-dark-text-muted">{s.title || '(출처 미상)'}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function MessageBubble({
  message,
  onConfirm,
  onCancel,
}: {
  message: Message;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary-500 dark:bg-dark-accent-strong text-white dark:text-gray-900 px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-error-50 dark:bg-dark-error-container border border-error-200 dark:border-transparent text-error-700 dark:text-dark-error px-3.5 py-2 text-sm whitespace-pre-wrap break-words">
          <p className="font-medium mb-1">오류가 발생했어요</p>
          <p className="text-xs">{message.content}</p>
        </div>
      </div>
    );
  }
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-gray-400 dark:text-dark-text-disabled">
          {message.content}
        </span>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border px-3.5 py-2.5 text-sm text-gray-800 dark:text-dark-text whitespace-pre-wrap break-words shadow-sm dark:shadow-none">
          {message.content || '(빈 응답)'}
        </div>

        {message.pendingAction && !message.actionResolved && (
          <div className="flex gap-2 pl-2">
            <button
              type="button"
              onClick={onConfirm}
              className="px-3 py-1 rounded-md bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 dark:bg-[#FFB800] dark:text-gray-900 dark:hover:bg-[#E6A600]"
            >
              승인
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 dark:bg-dark-surface dark:text-dark-text-muted dark:hover:bg-dark-elevated"
            >
              취소
            </button>
          </div>
        )}
        {message.pendingAction && message.actionResolved && (
          <p className="text-[11px] text-gray-500 dark:text-dark-text-muted pl-2">
            {message.actionResolved === 'confirmed' ? '승인됨' : '취소됨'}
          </p>
        )}

        {message.answerSource && (
          <SourceBadge
            source={message.answerSource}
            sources={message.sources ?? []}
            intent={message.intent}
          />
        )}
        {/* answerSource 가 없는 과거(혹은 agent 모드) 메시지에 대한 폴백 표시 */}
        {!message.answerSource && message.sources && message.sources.length > 0 && (
          <details className="text-xs text-gray-500 dark:text-dark-text-muted pl-1">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-dark-text select-none">
              참고한 문서 {message.sources.length}건
            </summary>
            <ul className="mt-1.5 space-y-0.5 pl-3">
              {message.sources.map((s, i) => (
                <li key={i} className="flex gap-2">
                  {typeof s.score === 'number' && (
                    <span className="tabular-nums text-gray-400 dark:text-dark-text-disabled">
                      {s.score.toFixed(2)}
                    </span>
                  )}
                  <span className="truncate">
                    <span className="text-gray-600 dark:text-dark-text-muted">{s.source_file}</span>
                    <span className="text-gray-400 dark:text-dark-text-disabled"> :: </span>
                    <span className="text-gray-700 dark:text-dark-text">{s.section_path}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
