import { describe, it, expect } from 'vitest'
import { formatDate } from '@/lib/utils/formatDate'

describe('formatDate', () => {
  it('Date 객체를 YYYY-MM-DD 로 변환(UTC 기준)', () => {
    expect(formatDate(new Date('2026-06-02T15:30:00.000Z'))).toBe('2026-06-02')
  })

  it('이미 문자열이면 그대로 반환', () => {
    expect(formatDate('2026-06-02')).toBe('2026-06-02')
  })
})
