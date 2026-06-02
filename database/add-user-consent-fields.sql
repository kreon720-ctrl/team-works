-- TEAM WORKS — user terms/privacy consent fields
-- 목적: 회원별 서비스 이용약관 및 개인정보 수집·이용 동의 기록을 저장한다.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(20) NULL;
