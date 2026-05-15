-- 카카오·구글 소셜 인증 도입을 위한 스키마 변경
-- 적용 일자: 2026-05-15
--
-- 배경: docs/25-kakao-and-google-auth.md
--
-- 변경 사항:
--   1. users.password_hash NOT NULL 해제 — OAuth 만 쓰는 사용자는 비밀번호 없음
--   2. oauth_accounts 신규 테이블 — 한 사용자가 여러 Provider 연결 가능
--   3. oauth_state 신규 테이블 — OAuth 인증 흐름의 state·PKCE verifier 임시 저장 (TTL 5분)
--
-- 안전성:
--   - 기존 사용자 데이터 무영향 (NOT NULL 만 해제, 기존 행은 모두 password_hash 보유)
--   - users.email 은 NOT NULL 유지 (이메일 동의 미허락 시 가입 거절 정책)

BEGIN;

-- 1) users.password_hash NOT NULL 해제
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- 2) oauth_accounts — 한 사용자가 여러 Provider 연결 가능
CREATE TABLE oauth_accounts (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(20)  NOT NULL,        -- 'kakao' | 'google'
    provider_user_id  VARCHAR(255) NOT NULL,        -- 카카오 회원번호 / 구글 sub
    provider_email    VARCHAR(255) NULL,            -- Provider 가 제공한 이메일
    provider_name     VARCHAR(255) NULL,            -- Provider 가 제공한 닉네임
    provider_picture  TEXT         NULL,            -- 프로필 이미지 URL
    linked_at         TIMESTAMP    NOT NULL DEFAULT now(),
    last_login_at     TIMESTAMP    NULL,
    CONSTRAINT chk_oauth_provider CHECK (provider IN ('kakao', 'google')),
    -- 같은 Provider 의 같은 외부 ID 는 한 사용자에게만 매핑
    CONSTRAINT uq_oauth_provider_pid UNIQUE (provider, provider_user_id),
    -- 한 사용자가 같은 Provider 를 두 번 연결 불가
    CONSTRAINT uq_oauth_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX idx_oauth_user_id ON oauth_accounts(user_id);

-- 3) oauth_state — 인증 시작 ↔ 콜백 사이 state·PKCE 임시 저장 (TTL 5분)
--    Redis 가 있으면 거기 저장하지만 현재 인프라엔 Redis 없음 → DB 사용
--    주기적으로 (예: 매 시간) `DELETE FROM oauth_state WHERE created_at < now() - interval '1 hour'` 청소
CREATE TABLE oauth_state (
    state          VARCHAR(64)  PRIMARY KEY,
    code_verifier  VARCHAR(128) NOT NULL,         -- PKCE code_verifier
    redirect_after VARCHAR(255) NULL,             -- 로그인 후 돌아갈 페이지 (안전 검증 후 사용)
    created_at     TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_state_created ON oauth_state(created_at);

COMMIT;
