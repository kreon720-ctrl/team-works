// AI 찰떡이 다중 턴 일정 대화 — 순수 NLP 로직(React 비의존).
//
// 직전 질문(previousQuestion)과 사용자의 보충 답변(supplement)을 needs 별로 결합해
// 한 줄짜리 완결 질문으로 재구성한다. 또한 다중 턴 진행 중 "새 요청 / 보충 입력" 판정에
// 쓰이는 가드용 정규식을 함께 제공한다.
//
// chat route(서버)는 자체 파싱용 정규식을 별도로 보유하며(역할이 다름), 이 모듈은
// 클라이언트의 follow-up 결합·가드 책임만 담당한다.

// === 다중 턴 가드용 정규식 (sendQuestion 에서 사용) ===

// 사용자 입력이 명백한 새 schedule 요청인지 판정 — schedule 동사 포함.
// awaiting-input 중에 새 요청이 들어오면 직전 대기 상태(updateState 등) 를 무시하고
// fresh classification 으로 진행. 단순 보충 입력엔 이 동사들 없음.
// rag/server.js 의 SCHEDULE_*_VERBS / 조회 동사와 의미상 일치하도록 모두 포함.
export const FRESH_SCHEDULE_REQUEST_RE = /(수정|변경|바꿔|옮겨|옮기|삭제|제거|지워|지운|등록|추가|만들|잡아|예약|넣어|생성|보여|알려|확인|조회|찾아|정리)/;
// schedule_update multi-step 답변 패턴 — "(으)로/라고 + 동사" 형태는 새 값 명시 답변이지
// 새 schedule 요청이 아님. 예: "저녁 고객미팅으로 바꿔줘" → 새 제목 명시 (FRESH 우회 대상).
// chat route 의 NEW_TITLE_TRAILING_RE 와 의미상 동일 — 동사 부분이 있어야 매치.
export const NEW_VALUE_HINT_RE = /(?:으로|로|라고)\s*(?:변경|바꿔|수정|이동|넣어|입력|부탁|해|줘)/;
// 직전 질문이 schedule_delete 의도였는지 판정 — needs:'title' 은 create 도 사용하므로 분기 구분용.
export const DELETE_INTENT_IN_PREV_RE = /(삭제|지워|지운|제거)/;
// 다중 후보 좁히기 단계에서 사용자가 "전체/모두/전부/모든/다 삭제" 같이 일괄 삭제를 시도하는지 판정.
// 매치되면 안내 후 awaiting-input 상태 유지 — 의도치 않은 대량 삭제 차단.
// "다섯/다른" 같은 합성어는 `다\s*(?:삭제|...)` 형태로만 잡아 false positive 회피.
export const BULK_DELETE_INTENT_RE = /(전체|모두|전부|모든|다\s*(?:삭제|지워|지운|제거))/;

// === rebuildFollowUpQuestion 내부 전용 정규식 ===

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
// supplement="2일" 단독 보충 + prev에 "X월" 단독 (뒤에 숫자 없음) → "X월 Y일" 로 결합용.
// 예: prev="5월 점심일정 삭제해줘" + supplement="2일" → "5월 2일 점심일정 삭제해줘"
const DAY_ONLY_SUPPLEMENT_RE = /^(\d{1,2})\s*일\s*$/;
const MONTH_ONLY_IN_PREV_RE = /(\d{1,2})\s*월(?!\s*\d)/;

// 다중 턴 일정 등록·삭제 — needs 별로 보충 답변을 직전 질문에 병합해 한 줄로 재구성.
// LLM 에 "X\n그리고 Y" 형태로 던지면 작은 모델일수록 두 절을 별개로 읽어 재차 같은 질문을
// 반복하거나 JSON 추출에 실패함. 결정론적 정규식 병합으로 LLM 부담 제거.
//
// fallback (정규식이 매치 못 함): 옛 "그리고" 포맷 유지 — 정보 손실 없음.
export function rebuildFollowUpQuestion(
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
    // 시각을 분 단서("반"/"N분")까지 통째로 추출 — "9시반"/"9시 30분" 의 분 정보를
    // 버리고 정시로 등록되던 버그 방지. 서버 normalizeKoreanDate 가 "반"→"30분" 변환.
    const timeInSupplement = supplement.match(/(\d+)\s*시(?:\s*반|\s*\d+\s*분)?/)?.[0]?.replace(/\s+/g, ' ').trim();
    const ampmInPrev = prev.match(AMPM_RE)?.[1];
    const AMPM_GLOBAL_RE = new RegExp(AMPM_RE.source, 'g');
    // 보충에 시각 전체 ("오후 3시", "9시반") → prev 의 시각 부분을 통째 교체
    if (ampm && timeInSupplement) {
      if (HOUR_RE.test(prev)) return prev.replace(HOUR_RE, `${ampm} ${timeInSupplement}`);
      // prev 에 시각 없으면 끝에 추가
      return `${prev} ${ampm} ${timeInSupplement}`;
    }
    // 보충에 AM/PM 만 ("오전"/"오후") — prev 의 기존 AM/PM 정정 의도로 보고 모두 교체 +
    // prev 에 시각이 있으면 시각 바로 앞에 ampm 이 인접하도록 보강 (detectTimeBand 매칭 보장).
    if (ampm) {
      if (HOUR_RE.test(prev)) {
        const cleaned = AMPM_GLOBAL_RE.test(prev)
          ? prev.replace(AMPM_GLOBAL_RE, '').replace(/\s+/g, ' ').trim()
          : prev;
        return cleaned.replace(HOUR_RE, (hr) => `${ampm} ${hr.trim()}`);
      }
      if (ampmInPrev) return prev.replace(AMPM_GLOBAL_RE, ampm);
      return `${prev} ${ampm}`;
    }
    // 보충에 "N시" 만 ("3시", "13시") — prev 에 AM/PM 시그널이 있으면 "${ampmInPrev} ${hour}시"
    // 로 직접 인접 결합 (detectTimeBand 가 ampm 을 정확히 잡도록). 없으면 단순 추가.
    if (timeInSupplement && !HOUR_RE.test(prev)) {
      if (ampmInPrev) {
        const cleaned = prev.replace(AMPM_GLOBAL_RE, '').replace(/\s+/g, ' ').trim();
        return `${cleaned} ${ampmInPrev} ${timeInSupplement}`;
      }
      return `${prev} ${timeInSupplement}`;
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
