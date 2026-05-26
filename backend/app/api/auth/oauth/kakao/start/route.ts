import { NextRequest, NextResponse } from 'next/server'
import { generateStateBundle, saveState } from '@/lib/auth/oauth/state'
import { buildKakaoAuthUrl } from '@/lib/auth/oauth/kakao'

interface StartRequestBody {
  redirectAfter?: string
}

/**
 * 안전한 redirectAfter 만 허용 — open redirect 방지.
 * 우리 도메인의 절대/상대 경로만 통과.
 */
function sanitizeRedirect(input: string | undefined | null): string | null {
  if (!input) return null
  // 절대 경로(`/teams/...`) 만 허용. 외부 URL 거부.
  if (input.startsWith('/') && !input.startsWith('//')) return input
  return null
}

/**
 * POST /api/auth/oauth/kakao/start
 *
 * 카카오 인증 URL 발급. 클라이언트는 응답의 url 로 location 이동.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: StartRequestBody = await request.json().catch(() => ({}))
    const redirectAfter = sanitizeRedirect(body.redirectAfter)

    const { state, codeVerifier, codeChallenge } = generateStateBundle()
    await saveState(state, codeVerifier, redirectAfter)

    const url = buildKakaoAuthUrl({ state, codeChallenge })
    return NextResponse.json({ url }, { status: 200 })
  } catch (err) {
    console.error('Kakao OAuth start 실패:', err)
    return NextResponse.json(
      { error: '카카오 로그인 시작 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
