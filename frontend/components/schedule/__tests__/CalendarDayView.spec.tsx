import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalendarDayView, computeLayout, getKSTMinutes, HOUR_PX } from '@/components/schedule/CalendarDayView';
import type { Schedule } from '@/types/schedule';

// KST = UTC+9. 테스트 일자: 2026-04-15 (KST)
// KST HH:MM → UTC ISO 문자열
function kstToUtc(dateStr: string, hh: number, mm = 0): string {
  const utcHH = hh - 9 < 0 ? hh - 9 + 24 : hh - 9;
  return `${dateStr}T${String(utcHH).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`;
}

const D = '2026-04-15';
function utc(hh: number, mm = 0): string {
  return kstToUtc(D, hh, mm);
}

function makeSchedule(id: string, startHH: number, endHH: number, opts?: Partial<Schedule>): Schedule {
  return {
    id,
    teamId: 'team-1',
    title: `일정 ${id}`,
    description: null,
    startAt: utc(startHH),
    endAt: utc(endHH),
    createdBy: 'user-1',
    createdAt: utc(0),
    updatedAt: utc(0),
    ...opts,
  };
}

const mockDate = new Date('2026-04-15T00:00:00.000Z'); // 2026-04-15 09:00 KST

// ─── getKSTMinutes ────────────────────────────────────────────────────────────

describe('getKSTMinutes', () => {
  it('00:00 UTC = 09:00 KST → 540분', () => {
    expect(getKSTMinutes('2026-04-15T00:00:00.000Z')).toBe(9 * 60);
  });

  it('00:30 UTC = 09:30 KST → 570분', () => {
    expect(getKSTMinutes('2026-04-15T00:30:00.000Z')).toBe(9 * 60 + 30);
  });

  it('15:00 UTC 전날 = 00:00 KST → 0분', () => {
    expect(getKSTMinutes('2026-04-14T15:00:00.000Z')).toBe(0);
  });
});

// ─── computeLayout ────────────────────────────────────────────────────────────

describe('computeLayout', () => {
  it('빈 배열 → 빈 배열 반환', () => {
    expect(computeLayout([])).toEqual([]);
  });

  it('1개 → column=0, totalColumns=1', () => {
    const result = computeLayout([makeSchedule('A', 10, 11)]);
    expect(result).toHaveLength(1);
    expect(result[0].column).toBe(0);
    expect(result[0].totalColumns).toBe(1);
  });

  it('겹치지 않는 2개 → 각각 totalColumns=1, 같은 column=0 재사용', () => {
    // A(10-11), B(14-15): 겹치지 않으므로 column 0을 재사용, 각각 100% 너비
    const result = computeLayout([makeSchedule('A', 10, 11), makeSchedule('B', 14, 15)]);
    expect(result[0].totalColumns).toBe(1);
    expect(result[1].totalColumns).toBe(1);
    // 둘 다 column=0 (겹치지 않으므로 동일 column 재사용)
    result.forEach(r => expect(r.column).toBe(0));
  });

  it('겹치는 2개 → 각각 totalColumns=2, column 0·1', () => {
    // A(10-12), B(11-13): 겹치므로 서로 다른 column
    const result = computeLayout([makeSchedule('A', 10, 12), makeSchedule('B', 11, 13)]);
    expect(result[0].totalColumns).toBe(2);
    expect(result[1].totalColumns).toBe(2);
    const cols = result.map(r => r.column).sort();
    expect(cols).toEqual([0, 1]);
  });

  it('겹치지 않는 3개 → 각각 totalColumns=1', () => {
    const s = [makeSchedule('A', 9, 10), makeSchedule('B', 11, 12), makeSchedule('C', 14, 15)];
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(1));
  });

  it('모두 겹치는 3개 → 각각 totalColumns=3', () => {
    // A(10-13), B(11-14), C(12-15): 모두 겹침
    const s = [makeSchedule('A', 10, 13), makeSchedule('B', 11, 14), makeSchedule('C', 12, 15)];
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(3));
  });

  it('동시에 시작하는 4개 → 각각 totalColumns=4', () => {
    const s = Array.from({ length: 4 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(4));
  });

  it('동시에 시작하는 5개 → 각각 totalColumns=5', () => {
    const s = Array.from({ length: 5 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(5));
  });

  it('동시에 시작하는 6개 → 각각 totalColumns=6 (가로 스크롤 케이스)', () => {
    const s = Array.from({ length: 6 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(6));
  });

  it('동시에 시작하는 10개 → 각각 totalColumns=10', () => {
    const s = Array.from({ length: 10 }, (_, i) => makeSchedule(`S${i}`, 9, 10));
    const result = computeLayout(s);
    result.forEach(r => expect(r.totalColumns).toBe(10));
  });

  it('시작 시각 오름차순 정렬 후 column 인덱스 배정 (겹치는 경우)', () => {
    // B가 먼저 들어와도 A(10시 시작)가 column=0, B(11시 시작)가 column=1
    // A(10-12), B(11-13)은 겹치므로 서로 다른 column에 배정
    const s = [makeSchedule('B', 11, 13), makeSchedule('A', 10, 12)];
    const result = computeLayout(s);
    const byId = Object.fromEntries(result.map(r => [r.schedule.id, r]));
    expect(byId['A'].column).toBe(0);
    expect(byId['B'].column).toBe(1);
  });

  it('같은 시작 시각: 긴 일정이 column=0', () => {
    // A(10-14), B(10-11) → 동시 시작, A가 더 긺
    const s = [makeSchedule('B', 10, 11), makeSchedule('A', 10, 14)];
    const result = computeLayout(s);
    const byId = Object.fromEntries(result.map(r => [r.schedule.id, r]));
    expect(byId['A'].column).toBe(0);
    expect(byId['B'].column).toBe(1);
  });

  it('startMin/endMin 정확히 계산됨', () => {
    const s = makeSchedule('A', 10, 11); // 10:00~11:00 KST
    const result = computeLayout([s]);
    expect(result[0].startMin).toBe(10 * 60); // 600
    expect(result[0].endMin).toBe(11 * 60);   // 660
  });

  it('분(minute) 포함 시각 계산: 10:30 시작', () => {
    const s = makeSchedule('A', 10, 11, { startAt: utc(10, 30) });
    const result = computeLayout([s]);
    expect(result[0].startMin).toBe(10 * 60 + 30); // 630
  });

  it('최소 높이 보장: 1분짜리 일정 → endMin = startMin + 15', () => {
    const s = makeSchedule('A', 10, 10, { endAt: utc(10, 1) });
    const result = computeLayout([s]);
    expect(result[0].endMin - result[0].startMin).toBe(15);
  });
});

// ─── CalendarDayView 컴포넌트 렌더링 ─────────────────────────────────────────

describe('CalendarDayView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('날짜 헤더가 표시된다', () => {
    render(<CalendarDayView currentDate={mockDate} />);
    expect(screen.getByText(/2026년/)).toBeInTheDocument();
  });

  it('일정 없을 때 "일정 0개" 표시', () => {
    render(<CalendarDayView currentDate={mockDate} schedules={[]} />);
    expect(screen.getByText('일정 0개')).toBeInTheDocument();
  });

  it('단일 일정 표시', () => {
    render(<CalendarDayView currentDate={mockDate} schedules={[makeSchedule('A', 10, 11)]} />);
    expect(screen.getByText('일정 A')).toBeInTheDocument();
    expect(screen.getByText('일정 1개')).toBeInTheDocument();
  });

  it('다른 날 일정은 표시되지 않는다', () => {
    const other: Schedule = {
      id: 'other', teamId: 'team-1', title: '다른날', description: null,
      startAt: '2026-04-16T01:00:00.000Z', endAt: '2026-04-16T02:00:00.000Z',
      createdBy: 'user-1', createdAt: utc(0), updatedAt: utc(0),
    };
    render(<CalendarDayView currentDate={mockDate} schedules={[other]} />);
    expect(screen.queryByText('다른날')).not.toBeInTheDocument();
    expect(screen.getByText('일정 0개')).toBeInTheDocument();
  });

  it('여러 일정이 모두 표시된다', () => {
    const s = [makeSchedule('A', 9, 10), makeSchedule('B', 11, 12), makeSchedule('C', 14, 15)];
    render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    expect(screen.getByText('일정 A')).toBeInTheDocument();
    expect(screen.getByText('일정 B')).toBeInTheDocument();
    expect(screen.getByText('일정 C')).toBeInTheDocument();
    expect(screen.getByText('일정 3개')).toBeInTheDocument();
  });

  it('일정 클릭 시 onScheduleClick 호출', () => {
    const onClick = vi.fn();
    const s = [makeSchedule('A', 10, 11)];
    render(<CalendarDayView currentDate={mockDate} schedules={s} onScheduleClick={onClick} />);
    fireEvent.click(screen.getByText('일정 A'));
    expect(onClick).toHaveBeenCalledWith(s[0]);
  });

  // ── 너비 규칙 ──────────────────────────────────────────────────────────────

  it('1개: 너비 100%', () => {
    const { container } = render(
      <CalendarDayView currentDate={mockDate} schedules={[makeSchedule('A', 10, 11)]} />
    );
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(bars[0].style.width).toBe('100%');
  });

  it('겹치지 않는 2개: 각각 너비 100% (비겹침 → 풀너비)', () => {
    // 겹치지 않는 일정은 각각 100% 너비로 자신의 시간대를 점유
    const s = [makeSchedule('A', 10, 11), makeSchedule('B', 14, 15)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(el.style.width).toBe('100%'));
  });

  it('겹치는 2개: 각각 50% 너비', () => {
    // A(10-12), B(11-13): 겹치므로 각각 50%
    const s = [makeSchedule('A', 10, 12), makeSchedule('B', 11, 13)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(el.style.width).toBe('50%'));
  });

  it('모두 겹치는 3개: 각각 33.3...% 너비', () => {
    // A(10-13), B(11-14), C(12-15): 모두 겹침
    const s = [makeSchedule('A', 10, 13), makeSchedule('B', 11, 14), makeSchedule('C', 12, 15)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(parseFloat(el.style.width)).toBeCloseTo(33.33, 1));
  });

  it('동시에 시작하는 4개: 각각 25% 너비', () => {
    const s = Array.from({ length: 4 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(el.style.width).toBe('25%'));
  });

  it('동시에 시작하는 5개: 각각 20% 너비', () => {
    const s = Array.from({ length: 5 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(el.style.width).toBe('20%'));
  });

  it('동시에 시작하는 6개: 각각 20% 너비 (가로 스크롤)', () => {
    const s = Array.from({ length: 6 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(parseFloat(el.style.width)).toBe(20));
  });

  it('동시에 시작하는 6개: 가로 스크롤 컨테이너 minWidth=120%', () => {
    const s = Array.from({ length: 6 }, (_, i) => makeSchedule(`S${i}`, 10, 14));
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const inner = container.querySelector('[style*="min-width: 120%"]') as HTMLElement | null;
    expect(inner).not.toBeNull();
  });

  it('10개: 각각 20% 너비 + minWidth=200%', () => {
    const s = Array.from({ length: 10 }, (_, i) => makeSchedule(`S${i}`, 9, 10));
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    bars.forEach(el => expect(parseFloat(el.style.width)).toBe(20));
    const inner = container.querySelector('[style*="min-width: 200%"]') as HTMLElement | null;
    expect(inner).not.toBeNull();
  });

  // ── 위치(top/height) 검증 ───────────────────────────────────────────────────

  it('세로 바 top: 10:00 KST = 560px', () => {
    const { container } = render(
      <CalendarDayView currentDate={mockDate} schedules={[makeSchedule('A', 10, 11)]} />
    );
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(bars[0].style.top).toBe('560px');
  });

  it('세로 바 height: 1시간 = 56px', () => {
    const { container } = render(
      <CalendarDayView currentDate={mockDate} schedules={[makeSchedule('A', 10, 11)]} />
    );
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(bars[0].style.height).toBe('56px');
  });

  it('분 단위 위치: 10:30 시작 → top=588px', () => {
    const s = makeSchedule('A', 10, 11, { startAt: utc(10, 30) });
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={[s]} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    // 10:30 KST = 630분 → (630/60)*56 = 588px
    expect(bars[0].style.top).toBe('588px');
  });

  it('2시간 일정 height: 112px', () => {
    const { container } = render(
      <CalendarDayView currentDate={mockDate} schedules={[makeSchedule('A', 10, 12)]} />
    );
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(bars[0].style.height).toBe('112px');
  });

  it('겹치지 않는 2개: 서로 다른 시간대에 각각 top 위치', () => {
    // A(10-11): top=560px, B(14-15): top=784px — 둘 다 left=0% (겹침 없음)
    const s = [makeSchedule('A', 10, 11), makeSchedule('B', 14, 15)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(bars[0].style.top).toBe('560px');  // 10:00 KST
    expect(bars[1].style.top).toBe('784px');  // 14:00 KST
    // 겹치지 않으므로 둘 다 left=0%
    expect(bars[0].style.left).toBe('0%');
    expect(bars[1].style.left).toBe('0%');
  });

  it('겹치는 2개: 첫 번째 일정 left=0%, 두 번째 left=50%', () => {
    // A(10-12), B(11-13): 겹치므로 좌우 분할
    const s = [makeSchedule('A', 10, 12), makeSchedule('B', 11, 13)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    // A가 먼저 시작 → column=0 → left=0%
    expect(bars[0].style.left).toBe('0%');
    expect(bars[1].style.left).toBe('50%');
  });

  it('모두 겹치는 3개: left 0%, 33.3%, 66.6%', () => {
    // A(10-13), B(11-14), C(12-15): 모두 겹침
    const s = [makeSchedule('A', 10, 13), makeSchedule('B', 11, 14), makeSchedule('C', 12, 15)];
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={s} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    expect(parseFloat(bars[0].style.left)).toBeCloseTo(0, 1);
    expect(parseFloat(bars[1].style.left)).toBeCloseTo(33.33, 1);
    expect(parseFloat(bars[2].style.left)).toBeCloseTo(66.67, 1);
  });

  // ── 기타 ────────────────────────────────────────────────────────────────────

  it('24개 시간 레이블이 모두 표시된다', () => {
    render(<CalendarDayView currentDate={mockDate} />);
    for (let h = 0; h < 24; h++) {
      expect(screen.getByText(`${String(h).padStart(2, '0')}:00`)).toBeInTheDocument();
    }
  });

  it('description: 2시간 이상 일정에서 표시됨', () => {
    const s = makeSchedule('A', 10, 12, { description: '상세 설명' });
    render(<CalendarDayView currentDate={mockDate} schedules={[s]} />);
    expect(screen.getByText('상세 설명')).toBeInTheDocument();
  });

  it('height is duration-based, not text-based: long title does not extend bar beyond duration', () => {
    // 200자 제목이어도 바 높이는 순수 시간 기반 (2시간 = 112px)
    const longTitle = 'a'.repeat(200);
    const s = makeSchedule('A', 15, 17, { title: longTitle });
    const { container } = render(<CalendarDayView currentDate={mockDate} schedules={[s]} />);
    const bars = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="%"]');
    // 15:00~17:00 KST = 2시간 → 2 × 56 = 112px
    expect(bars[0].style.height).toBe('112px');
  });
});
