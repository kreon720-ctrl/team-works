// ⚠️ WARNING: Vercel Serverless 환경에서는 함수 인스턴스마다 새 연결이 생성될 수 있음.
// 글로벌 싱글턴 패턴으로 동일 인스턴스 내 재사용. PgBouncer 또는 Neon serverless driver 사용 권장.
import { Pool, types } from 'pg'

// DATE 타입(OID 1082)을 JavaScript Date 객체로 변환하지 않고 문자열('YYYY-MM-DD')로 반환
// 기본 동작은 로컬 타임존 자정의 Date 객체로 변환해 UTC 기준 날짜가 하루 밀리는 문제가 발생함
types.setTypeParser(1082, (val: string) => val)

const globalForPg = global as unknown as { pgPool: Pool | undefined }

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })

// Non-production 환경에서 HMR 시 재사용을 위해 글로벌에 저장 (development + test 포함)
if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool
}
