import { NextRequest } from 'next/server'

export function resolvePublicBaseUrl(request: NextRequest): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')

  const fwdHost = request.headers.get('x-forwarded-host')
  if (fwdHost) {
    const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${fwdProto}://${fwdHost}`
  }

  const host = request.headers.get('host')
  if (host && !host.startsWith('backend') && !host.startsWith('localhost:3000')) {
    const proto = request.headers.get('x-forwarded-proto')
      ?? (host.startsWith('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return request.nextUrl.origin
}
