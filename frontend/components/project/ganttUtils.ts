// Gantt chart utility functions

/**
 * Returns the Sunday (start of week) for the week containing dateStr.
 */
export function getWeekStart(dateStr: string): Date {
  const date = new Date(dateStr + 'T00:00:00Z');
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 6=Sat
  const sunday = new Date(date);
  sunday.setUTCDate(date.getUTCDate() - dayOfWeek);
  return sunday;
}

/**
 * Returns all week starts (Sundays) that cover the project date range.
 * Weeks are assigned to months via Thursday convention.
 * Leading weeks whose Thursday falls before the project start month are excluded.
 */
export function getProjectWeeks(startDate: string, endDate: string): Date[] {
  const start = getWeekStart(startDate);
  const end = getWeekStart(endDate);

  const startDateObj = new Date(startDate + 'T00:00:00Z');
  const startYear = startDateObj.getUTCFullYear();
  const startMonth = startDateObj.getUTCMonth(); // 0-indexed

  const weeks: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    // Thursday of this week determines which month the week belongs to
    const thursday = new Date(current);
    thursday.setUTCDate(current.getUTCDate() + 4);

    const weekYear = thursday.getUTCFullYear();
    const weekMonth = thursday.getUTCMonth();

    // Exclude weeks that belong to months before the project start month
    if (weekYear > startYear || (weekYear === startYear && weekMonth >= startMonth)) {
      weeks.push(new Date(current));
    }

    current.setUTCDate(current.getUTCDate() + 7);
  }

  return weeks;
}

export interface MonthGroup {
  year: number;
  month: number; // 1-12
  weeks: Date[];
  weekIndices: number[]; // global indices into the weeks array
}

/**
 * 간트 한 칸(컬럼) — "한 주(週) ∩ 한 달(月)" 세그먼트.
 * 월 경계를 가로지르는 주는 달별로 쪼개져 두 컬럼이 된다.
 * 예: 6/28(일)~7/4(토) 주 → [6월 5주: 6/28~30], [7월 1주: 7/1~4] 두 컬럼.
 */
export interface GanttColumn {
  year: number;
  month: number; // 1-12
  weekOfMonth: number; // 그 달의 달력 주차(행 번호) 1~5
  start: string; // 'YYYY-MM-DD' 세그먼트 시작(포함)
  end: string; // 'YYYY-MM-DD' 세그먼트 끝(포함)
}

// 그 달 1일이 속한 주(일요일 시작)를 1주차로 본, weekSunday 의 달력 주차(행 번호).
function weekRowInMonth(weekSunday: Date, year: number, month0: number): number {
  const first = new Date(Date.UTC(year, month0, 1));
  const anchor = new Date(first);
  anchor.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const diff = Math.round((weekSunday.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(diff / 7) + 1;
}

/**
 * 프로젝트 기간을 "주 ∩ 월" 세그먼트 컬럼 배열로 만든다.
 * 순수 달력 기준 — 각 날짜가 달력에서 몇 번째 줄(주)에 있는지로 주차를 매기고,
 * 월이 바뀌는 주는 두 컬럼으로 분리한다 (6/28~30 = 6월 5주, 7/1~4 = 7월 1주).
 */
export function getProjectColumns(startDate: string, endDate: string): GanttColumn[] {
  const weeks = getProjectWeeks(startDate, endDate); // 일요일 시작 주들
  const [sY, sM] = startDate.split('-').map(Number);
  const [eY, eM] = endDate.split('-').map(Number);
  const startKey = sY * 12 + (sM - 1);
  const endKey = eY * 12 + (eM - 1);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const cols: GanttColumn[] = [];
  for (const sun of weeks) {
    const sat = new Date(sun);
    sat.setUTCDate(sun.getUTCDate() + 6);
    const firstKey = sun.getUTCFullYear() * 12 + sun.getUTCMonth();
    const lastKey = sat.getUTCFullYear() * 12 + sat.getUTCMonth();
    for (let key = firstKey; key <= lastKey; key++) {
      if (key < startKey || key > endKey) continue; // 프로젝트 범위 밖 달은 제외
      const y = Math.floor(key / 12);
      const m0 = key % 12;
      const monthStart = new Date(Date.UTC(y, m0, 1));
      const monthEnd = new Date(Date.UTC(y, m0 + 1, 0)); // 그 달 말일
      const segStart = sun > monthStart ? sun : monthStart;
      const segEnd = sat < monthEnd ? sat : monthEnd;
      cols.push({
        year: y,
        month: m0 + 1,
        weekOfMonth: weekRowInMonth(sun, y, m0),
        start: ymd(segStart),
        end: ymd(segEnd),
      });
    }
  }
  return cols;
}

/** 날짜가 포함되는 컬럼 인덱스. 범위 밖이면 처음/끝 컬럼으로 clamp. */
export function getColumnIndex(columns: GanttColumn[], dateStr: string): number {
  if (columns.length === 0) return 0;
  for (let i = 0; i < columns.length; i++) {
    if (dateStr >= columns[i].start && dateStr <= columns[i].end) return i;
  }
  return dateStr < columns[0].start ? 0 : columns.length - 1;
}

/** 컬럼들을 (연,월) 단위로 묶는다 (월 헤더 span 용). */
export function groupColumnsByMonth(columns: GanttColumn[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  columns.forEach((c, idx) => {
    const existing = groups.find((g) => g.year === c.year && g.month === c.month);
    const segStart = new Date(c.start + 'T00:00:00Z');
    if (existing) {
      existing.weeks.push(segStart);
      existing.weekIndices.push(idx);
    } else {
      groups.push({ year: c.year, month: c.month, weeks: [segStart], weekIndices: [idx] });
    }
  });
  return groups;
}

/**
 * Groups an array of week start dates by calendar month.
 * A week is assigned to the month that contains its Thursday (ISO convention),
 * or simply the month of the Sunday start — we use the month of the majority day
 * (Thursday of that week = Sunday + 4 days).
 */
export function groupWeeksByMonth(weeks: Date[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  weeks.forEach((week, idx) => {
    // Use Thursday of that week to determine which month the week "belongs" to
    const thursday = new Date(week);
    thursday.setUTCDate(week.getUTCDate() + 4);

    const year = thursday.getUTCFullYear();
    const month = thursday.getUTCMonth() + 1; // 1-12

    const existing = groups.find((g) => g.year === year && g.month === month);
    if (existing) {
      existing.weeks.push(week);
      existing.weekIndices.push(idx);
    } else {
      groups.push({ year, month, weeks: [week], weekIndices: [idx] });
    }
  });

  return groups;
}

/**
 * Returns the 1-based week-of-month for a given week start (Sunday).
 * Counts how many times that weekday (Sunday) has occurred in the month
 * using the Thursday convention for month assignment.
 */
export function getWeekOfMonth(weekStart: Date): number {
  // Determine the month of this week via Thursday
  const thursday = new Date(weekStart);
  thursday.setUTCDate(weekStart.getUTCDate() + 4);

  const month = thursday.getUTCMonth();
  const year = thursday.getUTCFullYear();

  // Count how many weeks in this month come before or equal to this week
  // Start from the first Sunday on or before the 1st of the month
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const firstSunday = new Date(firstOfMonth);
  firstSunday.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());

  // Find the Thursday of that first Sunday's week
  const firstThursday = new Date(firstSunday);
  firstThursday.setUTCDate(firstSunday.getUTCDate() + 4);

  // If that Thursday is in a different month, start from the next Sunday
  let cursor = new Date(firstSunday);
  if (firstThursday.getUTCMonth() !== month || firstThursday.getUTCFullYear() !== year) {
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  let weekNum = 0;
  const targetTime = weekStart.getTime();

  while (cursor.getTime() <= targetTime) {
    const cursorThursday = new Date(cursor);
    cursorThursday.setUTCDate(cursor.getUTCDate() + 4);
    if (cursorThursday.getUTCMonth() === month && cursorThursday.getUTCFullYear() === year) {
      weekNum++;
    }
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return Math.max(weekNum, 1);
}

/**
 * Finds the index in weeks[] of the week that contains the given date.
 * Uses Thursday convention for month assignment.
 *
 * mode 'start': if the containing week belongs to an earlier month than the
 *   date, advance to the next week (bar starts in the correct month).
 * mode 'end': if the containing week belongs to a later month than the
 *   date, retreat to the previous week (bar ends in the correct month).
 */
export function getWeekIndex(weeks: Date[], dateStr: string, mode: 'start' | 'end' = 'start'): number {
  const target = new Date(dateStr + 'T00:00:00Z');
  const targetMonth = target.getUTCMonth();
  const targetYear = target.getUTCFullYear();

  if (weeks.length === 0) return 0;

  // Find the last week start that is <= target
  let result = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i] <= target) {
      result = i;
    } else {
      break;
    }
  }

  // Determine the month of the found week via Thursday convention
  const foundWeek = weeks[result];
  const thursday = new Date(foundWeek);
  thursday.setUTCDate(foundWeek.getUTCDate() + 4);
  const weekYear = thursday.getUTCFullYear();
  const weekMonth = thursday.getUTCMonth();

  // target 이 발견된 week (Sunday) 의 7일 안에 실제로 포함되는지.
  // Thursday-convention 으로 다른 달로 분류된 주여도 target 이 그 주에 있으면
  // advance/retreat 하지 않음 — 그러지 않으면 월말(6/30 화) 같은 케이스에서
  // bar 가 잘려 누락됨 (6/30 의 주가 목요일 7/2 라 July 로 분류되는 부작용).
  const foundWeekEnd = new Date(foundWeek);
  foundWeekEnd.setUTCDate(foundWeek.getUTCDate() + 6);
  const targetInFoundWeek = target >= foundWeek && target <= foundWeekEnd;

  if (mode === 'start') {
    // Week is in an earlier month → advance to next week
    // 단 target 이 그 주에 있으면 그대로 사용 (월초 케이스 보호).
    if (
      !targetInFoundWeek &&
      (weekYear < targetYear || (weekYear === targetYear && weekMonth < targetMonth))
    ) {
      if (result + 1 < weeks.length) result += 1;
    }
  } else {
    // Week is in a later month → retreat to previous week
    // 단 target 이 그 주에 있으면 그대로 사용 (월말 케이스 보호 — 6/30 같이 화요일이
    // 그 주의 목요일이 다음달이라 잘못 retreat 되어 bar 가 짧아지는 문제 차단).
    if (
      !targetInFoundWeek &&
      (weekYear > targetYear || (weekYear === targetYear && weekMonth > targetMonth))
    ) {
      if (result > 0) result -= 1;
    }
  }

  return result;
}

/**
 * Returns true if the week at weekIdx is the first week of a new month group
 * (i.e., it's a month boundary and should receive a thick left border).
 */
export function isMonthBoundary(monthGroups: MonthGroup[], weekIdx: number): boolean {
  for (const group of monthGroups) {
    if (group.weekIndices.length > 0 && group.weekIndices[0] === weekIdx) {
      return true;
    }
  }
  return false;
}
