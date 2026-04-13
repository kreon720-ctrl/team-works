import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth/jwt'
import { getUserById } from '@/lib/db/queries/userQueries'

/**
 * GET /api/auth/me
 *
 * 현재 로그인한 사용자 정보 반환
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request.headers.get('Authorization'))
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const payload = verifyAccessToken(token)
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
    }

    const user = await getUserById(payload.userId)
    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    })
  } catch (err) {
    console.error('GET /api/auth/me error:', err)
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
