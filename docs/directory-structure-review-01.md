# 디렉토리 구조 Vercel 배포 적합성 검토 결과

## 검토 일시
2026-04-09

## 검토 대상
docs/4-project-structure.md (v1.4)

## 검토 시나리오
1. `backend/` 디렉토리 기준 Vercel 백엔드 단독 배포 + Swagger UI API 테스트
2. `frontend/` 디렉토리 기준 Vercel 프론트엔드 단독 배포

---

## 발견된 문제 및 조치

| # | 항목 | 문제 내용 | 조치 |
|---|------|-----------|------|
| 1 | **backend/ 루트 설정 파일 누락** | 섹션 6 최상위 구조에서 `next.config.ts`, `package.json`, `tsconfig.json`이 프로젝트 루트에만 명시되어 있었음. Vercel에서 `backend/`를 Root Directory로 지정하면 해당 파일들이 `backend/` 안에 있어야 함 | 섹션 8 백엔드 디렉토리 구조에 `backend/next.config.ts`, `backend/tsconfig.json`, `backend/package.json` 명시. 섹션 6 최상위 구조 설명도 각 서비스별 독립 배포 단위임을 명확히 수정완료 |
| 2 | **frontend/ 루트 설정 파일 누락** | 섹션 7 프론트엔드 구조에 `next.config.ts`, `package.json`, `tsconfig.json`이 명시되어 있지 않았음 | 섹션 7 선두에 `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/package.json` 명시 수정완료 |
| 3 | **Swagger 파일 위치 오류** | `swagger/`가 프로젝트 루트에만 존재함. `backend/`를 배포 루트로 지정하면 프로젝트 루트의 `swagger/`는 배포 범위 밖이 되어 접근 불가 | 섹션 8에 `backend/swagger/swagger.json` 및 `backend/app/swagger/route.ts` (명세 서빙 API Route) 추가. Swagger UI 서빙 방식 주의사항 명시 수정완료 |
| 4 | **환경변수 위치 미명시** | `.env.local` / `.env.example`이 어느 디렉토리에 위치해야 하는지 문서에 명시되지 않았음. Vercel 배포 루트가 `backend/` 또는 `frontend/`이므로 환경변수 파일도 해당 디렉토리에 있어야 함 | 섹션 5 환경변수 관리 항목에서 `backend/.env.local`, `frontend/.env.local` 위치를 명시하고 서비스별 분리 원칙 추가 수정완료 |
| 5 | **NEXT_PUBLIC_API_URL 미명시** | 프론트엔드가 백엔드 API URL을 참조하는 방법이 문서에 없었음. 별도 Vercel 프로젝트로 분리 배포 시 백엔드 URL을 환경변수로 주입해야 함 | 섹션 5에 `NEXT_PUBLIC_API_URL` 환경변수 추가 및 설명, `frontend/.env.example`에 해당 키 목록 명시 수정완료 |
| 6 | **apiClient.ts API URL 참조 미명시** | `frontend/lib/apiClient.ts`가 `NEXT_PUBLIC_API_URL`을 사용하는 구조임이 문서에 명시되지 않았음 | 섹션 7 프론트엔드 구조의 `apiClient.ts` 주석 및 하단 주의사항에 `NEXT_PUBLIC_API_URL` 환경변수 기반 URL 조립 구조 명시 수정완료 |
| 7 | **pg Pool 경로 참조** | 섹션 8의 `pool.ts`에 파일 경로가 명시되지 않아 다른 섹션에서 참조 시 혼동 가능 | 섹션 8의 `pool.ts` 주석에 `backend/lib/db/pool.ts` 전체 경로 명시 수정완료 |

---

## 배포 구성 가이드

### backend/ Vercel 배포 설정

Vercel 프로젝트 생성 시 **Root Directory** 를 `backend` 로 지정합니다.

**vercel.json** (backend/vercel.json 예시):
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "functions": {
    "app/api/**": {
      "maxDuration": 10
    }
  }
}
```

**환경변수 목록** (Vercel Dashboard > backend 프로젝트 > Settings > Environment Variables):

| 변수명 | 설명 | 예시 값 |
|--------|------|---------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://user:pass@host:5432/dbname` |
| `JWT_ACCESS_SECRET` | Access Token 서명 키 | 임의의 랜덤 문자열 (32자 이상) |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 키 | 임의의 랜덤 문자열 (32자 이상) |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 만료 시간 | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 만료 시간 | `7d` |

### frontend/ Vercel 배포 설정

Vercel 프로젝트 생성 시 **Root Directory** 를 `frontend` 로 지정합니다.

**vercel.json** (frontend/vercel.json 예시):
```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "outputDirectory": ".next"
}
```

**환경변수 목록** (Vercel Dashboard > frontend 프로젝트 > Settings > Environment Variables):

| 변수명 | 설명 | 예시 값 |
|--------|------|---------|
| `NEXT_PUBLIC_API_URL` | 백엔드 Vercel 배포 URL | `https://caltalk-api.vercel.app` |

> `NEXT_PUBLIC_` 접두사가 없으면 브라우저(클라이언트)에서 접근 불가합니다. 반드시 접두사를 포함해야 합니다.

**apiClient.ts 구현 패턴**:
```typescript
// frontend/lib/apiClient.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
      ...init?.headers,
    },
  })
  return res
}
```

### Swagger UI 접근 방법

백엔드 배포 후 Swagger UI를 통한 API 테스트는 다음 두 가지 방법으로 구성합니다.

**방법 1: backend/public/ 정적 파일 + 외부 CDN Swagger UI (권장)**

1. `backend/public/swagger/swagger.json` 에 OpenAPI 명세 파일 배치
2. `backend/public/swagger/index.html` 을 아래와 같이 작성:

```html
<!DOCTYPE html>
<html>
<head>
  <title>CalTalk API Docs</title>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/swagger/swagger.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    })
  </script>
</body>
</html>
```

3. Vercel의 정적 파일 서빙으로 `https://<backend-domain>/swagger/index.html` 접근

**방법 2: API Route를 통한 swagger.json 서빙**

`backend/app/swagger/route.ts` 에서 명세 파일을 읽어 JSON 응답으로 반환합니다.

```typescript
// backend/app/swagger/route.ts
import { NextResponse } from 'next/server'
import swaggerJson from '../../../swagger/swagger.json'

export async function GET() {
  return NextResponse.json(swaggerJson)
}
```

접근 URL: `GET https://<backend-domain>/swagger` → swagger.json 반환

Swagger UI 페이지는 `backend/public/swagger-ui/index.html` 에서 위 URL을 spec URL로 지정합니다.

---

## 결론

`docs/4-project-structure.md` v1.3 기준으로는 **Vercel 단독 배포 시나리오에서 3가지 구조적 문제**가 존재했습니다.

1. `backend/`와 `frontend/` 각각에 Next.js 설정 파일(`next.config.ts`, `package.json`, `tsconfig.json`)이 명시되지 않아 Vercel 배포 루트 지정 시 빌드 실패 가능성 있음
2. Swagger 명세 파일(`swagger.json`)이 프로젝트 루트에만 존재하여 `backend/` 배포 범위 밖에 위치함
3. 프론트-백엔드 간 API URL 연결 구조(`NEXT_PUBLIC_API_URL`)가 문서에 정의되지 않아 분리 배포 후 연결 설정 기준 부재

v1.4에서 이 세 가지 문제를 포함하여 총 7개 항목이 수정·보완되었습니다. 수정된 구조 기준으로 `backend/`와 `frontend/`는 각각 독립적인 Vercel 프로젝트로 배포 가능하며, Swagger UI는 `backend/public/` 정적 파일 또는 API Route를 통해 서빙할 수 있습니다. **전체 배포 시나리오는 v1.4 기준으로 실행 가능한 상태입니다.**
