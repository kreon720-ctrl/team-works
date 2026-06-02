// pg 가 DATE 컬럼을 Date 객체로 반환 — 응답 직렬화 시 'YYYY-MM-DD' 문자열로 변환.
// 이미 문자열(또는 호출부가 string 으로 다루는 값)이면 그대로 통과.
export function formatDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  return value as string
}
