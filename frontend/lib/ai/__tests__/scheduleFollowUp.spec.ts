import { describe, it, expect } from 'vitest';
import {
  rebuildFollowUpQuestion,
  FRESH_SCHEDULE_REQUEST_RE,
  NEW_VALUE_HINT_RE,
  DELETE_INTENT_IN_PREV_RE,
  BULK_DELETE_INTENT_RE,
} from '@/lib/ai/scheduleFollowUp';

describe('rebuildFollowUpQuestion', () => {
  describe("needs='datetime'", () => {
    it('보충을 prev 끝에 단순 결합한다', () => {
      expect(rebuildFollowUpQuestion('내일 회의 등록해줘', 'datetime', '오후 3시')).toBe(
        '내일 회의 등록해줘 오후 3시',
      );
    });
  });

  describe("needs='time'", () => {
    it('보충이 자체완결 datetime("9일 20시")이면 prev 무시하고 보충만 사용', () => {
      expect(rebuildFollowUpQuestion('내일 회의', 'time', '9일 20시')).toBe('9일 20시');
    });

    it('보충에 AM/PM+시각 → prev 의 시각 부분을 통째 교체', () => {
      expect(rebuildFollowUpQuestion('내일 3시 회의 등록', 'time', '오후 3시')).toBe(
        '내일 오후 3시 회의 등록',
      );
    });

    it('보충에 AM/PM 만 → prev 시각 앞에 인접 보강', () => {
      expect(rebuildFollowUpQuestion('내일 3시 회의', 'time', '오후')).toBe('내일 오후 3시 회의');
    });

    it('보충에 시각만 + prev 에 시각 없음 → 끝에 추가', () => {
      expect(rebuildFollowUpQuestion('내일 회의 등록', 'time', '3시')).toBe('내일 회의 등록 3시');
    });
  });

  describe("needs='date'", () => {
    it('보충에 날짜 단서 → prev 앞에 prepend', () => {
      expect(rebuildFollowUpQuestion('회의 등록해줘', 'date', '내일')).toBe('내일 회의 등록해줘');
    });
  });

  describe("needs='title'", () => {
    it('보충이 자체완결 schedule 질문(명사+동사)이면 그대로 사용', () => {
      expect(rebuildFollowUpQuestion('다음주 점심일정 삭제', 'title', '15일 일정 삭제')).toBe(
        '15일 일정 삭제',
      );
    });

    it('보충="X일" + prev 에 월만 있음 → "X월 Y일" 로 결합', () => {
      expect(rebuildFollowUpQuestion('5월 점심일정 삭제해줘', 'title', '2일')).toBe(
        '5월 2일 점심일정 삭제해줘',
      );
    });

    it('보충="X일" + prev 에 시점 단서 없음 → prev 앞에 prepend', () => {
      expect(rebuildFollowUpQuestion('전체 회의 일정 삭제해줘', 'title', '5일')).toBe(
        '5일 전체 회의 일정 삭제해줘',
      );
    });

    it('보충에 날짜 단서 + prev 에도 날짜 단서 → prev 의 날짜 부분 교체', () => {
      expect(rebuildFollowUpQuestion('다음주 점심일정 삭제', 'title', '15일')).toBe(
        '15일 점심일정 삭제',
      );
    });

    it('제목/키워드 보충 → prev 의 동사 앞에 삽입', () => {
      expect(rebuildFollowUpQuestion('내일 미팅 삭제해줘', 'title', '고객사')).toBe(
        '내일 미팅 고객사 삭제해줘',
      );
    });
  });

  it('알 수 없는 needs 는 fallback("그리고") 포맷', () => {
    expect(rebuildFollowUpQuestion('내일 회의', 'unknown', '메모')).toBe('내일 회의\n그리고 메모');
  });
});

describe('가드 정규식', () => {
  it('FRESH_SCHEDULE_REQUEST_RE — schedule 동사를 새 요청으로 감지', () => {
    expect(FRESH_SCHEDULE_REQUEST_RE.test('8일 회의 수정해줘')).toBe(true);
    expect(FRESH_SCHEDULE_REQUEST_RE.test('오후 3시')).toBe(false);
  });

  it('NEW_VALUE_HINT_RE — "(으)로/라고 + 동사" 새 값 명시 패턴', () => {
    expect(NEW_VALUE_HINT_RE.test('저녁 고객미팅으로 바꿔줘')).toBe(true);
    expect(NEW_VALUE_HINT_RE.test('고객미팅')).toBe(false);
  });

  it('DELETE_INTENT_IN_PREV_RE — 삭제 의도 감지', () => {
    expect(DELETE_INTENT_IN_PREV_RE.test('점심 일정 삭제')).toBe(true);
    expect(DELETE_INTENT_IN_PREV_RE.test('점심 일정 등록')).toBe(false);
  });

  it('BULK_DELETE_INTENT_RE — 일괄 삭제만 감지, 합성어 false positive 회피', () => {
    expect(BULK_DELETE_INTENT_RE.test('전체 삭제')).toBe(true);
    expect(BULK_DELETE_INTENT_RE.test('다 지워')).toBe(true);
    expect(BULK_DELETE_INTENT_RE.test('다섯 개 일정')).toBe(false);
  });
});
