import { NextRequest, NextResponse } from 'next/server'
import { generateStateBundle, saveState } from '@/lib/auth/oauth/state'
import { buildGoogleAuthUrl } from '@/lib/auth/oauth/google'

interface StartRequestBody {
  redirectAfter?: string
}

function sanitizeRedirect(input: string | undefined | null): string | null {
  if (!input) return null
  if (input.startsWith('/') && !input.startsWith('//')) return input
  return null
}

/**
 * POST /api/auth/oauth/google/start
 *
 * Google 인증 URL 발급. 클라이언트는 응답의 url 로 location 이동.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: StartRequestBody = await request.json().catch(() => ({}))
    const redirectAfter = sanitizeRedirect(body.redirectAfter)

    const { state, codeVerifier, codeChallenge } = generateStateBundle()
    await saveState(state, codeVerifier, redirectAfter)

    const url = buildGoogleAuthUrl({ state, codeChallenge })
    return NextResponse.json({ url }, { status: 200 })
  } catch (err) {
    console.error('Google OAuth start 실패:', err)
    return NextResponse.json(
      { error: 'Google 로그인 시작 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
