# 운영 환경 배포 가이드

> 현재 개발 환경(로컬 macOS + Docker Compose) 을 운영 환경(단일 Linux 호스트)으로 이전하기 위한 단계별 가이드. 멀티 호스트·HA 는 후속.
> 관련 문서: [`docs/15-docker-container-gen.md`](./15-docker-container-gen.md), [`docs/13`](./13-RAG-pipeline-guide.md), [`docs/14`](./14-Open-WebUI-plan.md), [`docs/18`](./18-board-guide.md).

## 문서 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-04-29 | 최초 작성 — 단일 호스트 배포 절차 + 시크릿·DB·AI·첨부파일·HTTPS·롤백·운영 가이드 |

---

## 1. 현재 환경 vs 운영 환경 차이

| 항목 | 개발 (로컬) | 운영 (단일 호스트) |
|------|------------|---------------------|
| 호스트 | macOS, Docker Desktop | Linux VM (Ubuntu 22.04 LTS 권장), Docker CE |
| 도메인·HTTPS | `localhost:8080` HTTP | `teamworks.example.com` HTTPS (Let's Encrypt) |
| Ollama | macOS 호스트 (`host.docker.internal:11434`) | Linux 호스트의 systemd 서비스 (`ollama.service`) 또는 GPU 워커 별도 |
| RAG 서버 | `nohup node server.js` | `systemd` 또는 별도 컨테이너 |
| Postgres | docker volume `pgdata` | 동일하지만 매일 dump → S3 백업 |
| 첨부파일 | 호스트 `./files` mount | **S3** (`STORAGE_BACKEND=s3` 토글) |
| 시크릿 | `.env`, `backend/.env.local` | 동일 파일 + `chmod 600` + 백업에서 제외. 또는 Docker secrets |
| 인증서 | 없음 (HTTP) | Let's Encrypt + nginx 자동 갱신 |
| 로그 | `docker logs` 즉석 | `docker logs --tail` 또는 외부 수집(loki/cloudwatch) |
| 배포 | `docker compose up -d` | 동일 + git pull + `docker compose pull && up -d` |

> **핵심 격언**: 운영 환경은 **개발 환경의 docker-compose.yml 한 벌 + 변경된 env + S3 토글** 만으로 시작. 추가 인프라 코드 0건이 목표.

## 2. 사전 준비

### 2.1 호스트 사양 (단일 호스트, 50명 동시 사용 가정)

| 컴포넌트 | 최소 | 권장 |
|---------|------|------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 16 GB | 32 GB (gemma4:26b 가 ~16GB 사용) |
| 디스크 | 100 GB SSD | 200 GB NVMe |
| GPU (Ollama 가속) | 선택 | NVIDIA RTX 4090 / A10 또는 이상 — 답변 속도 5~10배 ↑ |
| 대역폭 | 100 Mbps | 1 Gbps |

> AI 모델 응답 시간이 **사용 경험의 병목**이라 GPU 가 가장 큰 ROI. CPU만으로도 동작은 하지만 답변 30~120초.

### 2.2 도메인 / SSL

- 도메인 1개 — 예: `teamworks.example.com`
- DNS A 레코드를 호스트 IP 로 매핑
- Let's Encrypt 인증서 — `certbot` 또는 `nginx-proxy-manager` 컨테이너로 자동 발급·갱신
- (선택) wildcard `*.teamworks.example.com` 으로 추후 staging/admin 서브도메인 대비

### 2.3 환경 변수 / 시크릿

| 파일 | 내용 | 보호 |
|------|------|------|
| `.env` (루트) | `OPEN_WEBUI_SECRET_KEY`, `OPEN_WEBUI_API_KEY` | `chmod 600` + git ignore + 호스트 백업에서 별도 보관 |
| `backend/.env.local` | `JWT_SECRET`, `DATABASE_URL`, `STORAGE_S3_BUCKET` 등 | 동일 |
| `frontend/.env.local` (있다면) | public 키만 | git ignore |

**JWT_SECRET 생성**:
```bash
openssl rand -hex 64
```

**시크릿 백업** — `.env` 파일들은 호스트 별도 디렉토리(예: `/var/secrets/teamworks/`) 에 동기화 보관, 1Password/Bitwarden 같은 매니저에 백업.

### 2.4 호스트 초기 설정 (1회)

```bash
# Docker + docker-compose 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Ollama 설치 (호스트)
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull gemma4:26b
ollama pull nomic-embed-text

# 방화벽
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 코드 클론 + 디렉토리
git clone https://github.com/<org>/team-works.git /opt/team-works
cd /opt/team-works
mkdir -p files  # 1단계 storage. S3 전환 시 미사용
```

## 3. 운영용 docker-compose 변경

개발 `docker-compose.yml` 을 그대로 쓰되 **3가지만 변경**:

### 3.1 nginx — HTTPS 활성

`docker/nginx.prod.conf` 신규 (개발 conf 미러):
- `listen 443 ssl http2`
- `ssl_certificate /etc/letsencrypt/live/.../fullchain.pem`
- `ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem`
- HTTP(80) 은 모두 HTTPS 로 301 redirect

`docker-compose.prod.yml` 의 nginx 서비스:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./docker/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 3.2 backend — 첨부파일 S3 전환

```yaml
backend:
  environment:
    NODE_ENV: production
    STORAGE_BACKEND: s3
    STORAGE_S3_BUCKET: teamworks-prod-attachments
    STORAGE_S3_REGION: ap-northeast-2
    STORAGE_S3_PRESIGN_TTL_SEC: 300
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  # ./files 마운트 제거
```

> S3 전환 작업은 §6 참고. 1단계 단순 운영이면 local mount 그대로 두고 호스트 백업 정책으로 갈음 가능.

### 3.3 frontend — Open WebUI URL · 환경

운영에선 `NEXT_PUBLIC_API_URL=https://teamworks.example.com` 로 외부 URL.

> 운영 전용 파일을 따로 두지 말고 **`docker-compose.yml` 하나 + `docker-compose.prod.override.yml` 하나** 패턴 권장. `docker compose -f docker-compose.yml -f docker-compose.prod.override.yml up -d`.

## 4. 데이터베이스

### 4.1 초기 스키마 적용

```bash
# 컨테이너 기동 후
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/schema.sql

# 자료실 / 프로젝트 채팅 / 프로젝트 공지 마이그레이션
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-project-chat.sql
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-project-notice.sql
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-board.sql
```

### 4.2 일일 백업 (cron)

```bash
# /etc/cron.d/teamworks-db-backup
0 3 * * * root docker compose -f /opt/team-works/docker-compose.yml exec -T db \
  pg_dump -U teamworks-manager teamworks | gzip > /var/backups/teamworks/db-$(date +\%Y\%m\%d).sql.gz \
  && find /var/backups/teamworks -name 'db-*.sql.gz' -mtime +30 -delete
```

S3 동기화 추가 (선택):
```bash
aws s3 sync /var/backups/teamworks/ s3://teamworks-prod-backups/db/
```

### 4.3 복구 검증

```bash
# 백업 파일을 임시 컨테이너에 적재해 정합성 검증 (월 1회)
docker run --rm -v /var/backups/teamworks:/backups postgres:18 \
  bash -c 'gunzip -c /backups/db-LATEST.sql.gz | psql -h db -U teamworks-manager teamworks'
```

## 5. AI / RAG 서버

### 5.1 Ollama 모델 준비

- gemma4:26b — 답변용 (~16GB)
- nomic-embed-text — 임베딩용 (~600MB)

```bash
ollama pull gemma4:26b
ollama pull nomic-embed-text
ollama list  # 확인
```

### 5.2 RAG 인덱스

```bash
cd /opt/team-works/rag
npm install
npm run index   # ollama/*.md → rag/data/chunks.json (1회)
```

`ollama/*.md` (TEAM WORKS 공식 문서) 변경 시 재인덱싱 + RAG 서버 재기동.

### 5.3 RAG 서버 systemd 서비스

`/etc/systemd/system/teamworks-rag.service`:
```ini
[Unit]
Description=TEAM WORKS RAG Server
After=network.target ollama.service

[Service]
Type=simple
User=teamworks
WorkingDirectory=/opt/team-works/rag
Environment=OLLAMA_HOST=http://127.0.0.1:11434
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now teamworks-rag
```

> 운영에선 `nohup node server.js` 가 아니라 systemd 로 관리해야 재기동·로그·자동 부팅 모두 자동화.

### 5.4 Open WebUI / SearxNG

기존 docker-compose 그대로. Open WebUI 의 admin 설정(`gemma4-web` 모델·웹 검색·임베딩 우회) 은 v0.9 의 admin DB 우선 정책상 1회 GUI 로 설정 후 volume 보존.

## 6. 첨부파일 — S3 전환 절차 (선택)

상세는 [`docs/18-board-guide.md`](./18-board-guide.md) §6 참고. 요약:

1. AWS 콘솔에서 버킷 생성 (versioning 활성, public access 차단)
2. IAM 사용자 생성 또는 EC2 IAM role — `s3:GetObject/PutObject/DeleteObject` 권한
3. `backend/lib/files/s3Storage.ts` 의 `throw` 자리에 SDK 호출 채움 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
4. `scripts/migrate-files-to-s3.ts` 1회 실행 — 기존 `files/*` 를 같은 key 로 S3 PUT (idempotent)
5. env `STORAGE_BACKEND=s3` + 자격증명 → backend 재기동
6. `docker-compose.yml` 의 `./files:/app/files` mount 제거

호출처(boardQueries / route handlers / frontend) 변경 0건.

## 7. HTTPS — Let's Encrypt

```bash
# certbot standalone (nginx 정지 후 1회 발급)
sudo apt install certbot
docker compose stop nginx
sudo certbot certonly --standalone -d teamworks.example.com -m admin@example.com --agree-tos
docker compose start nginx

# 자동 갱신 (cron)
echo '0 4 * * * root certbot renew --quiet --post-hook "docker compose -f /opt/team-works/docker-compose.yml restart nginx"' | sudo tee /etc/cron.d/certbot-renew
```

## 8. 배포 절차

### 8.1 초기 배포 (1회)

```bash
# 1) 호스트 준비 (§2.4 완료 가정)
cd /opt/team-works

# 2) 시크릿 파일 생성
cp .env.example .env  # 또는 1Password 에서 복사
vim .env  # OPEN_WEBUI_SECRET_KEY 등 채움
chmod 600 .env backend/.env.local

# 3) Ollama 모델 + RAG 인덱스
ollama pull gemma4:26b nomic-embed-text
cd rag && npm install && npm run index && cd ..

# 4) 컨테이너 기동
docker compose -f docker-compose.yml -f docker-compose.prod.override.yml up -d

# 5) DB 스키마 적용
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/schema.sql
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-project-chat.sql
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-project-notice.sql
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-board.sql

# 6) RAG 서버 systemd 등록
sudo systemctl enable --now teamworks-rag

# 7) HTTPS (§7 완료)

# 8) 검증 (§9)
```

### 8.2 후속 업데이트 배포

```bash
cd /opt/team-works
git pull origin main

# 코드만 변경된 경우 (대부분)
docker compose up -d --no-deps --force-recreate backend frontend
sudo systemctl restart teamworks-rag  # rag/server.js 변경 시

# DB 마이그레이션이 있는 경우
ls database/add-*.sql | tail -1  # 새 마이그레이션 확인
docker compose exec -T db psql -U teamworks-manager -d teamworks < database/add-XXX.sql

# RAG 인덱스 재빌드 (ollama/*.md 변경 시)
cd rag && npm run index && sudo systemctl restart teamworks-rag
```

## 9. 검증 체크리스트

- [ ] `https://teamworks.example.com` 접속 → 로그인 화면 표시
- [ ] 회원가입 → 새 사용자 생성 + 로그인
- [ ] 팀 생성 → DB 에 row 보임 (`docker compose exec db psql ... -c "SELECT * FROM teams"`)
- [ ] 일정 등록 → 캘린더 표시
- [ ] 채팅 메시지 송수신 (3초 폴링)
- [ ] 자료실 글 + 첨부파일 등록 → S3 (또는 호스트 `files/`) 에 객체 생성 확인
- [ ] 첨부파일 다운로드 → 정상 stream 또는 redirect
- [ ] AI 어시스턴트:
  - 사용법 ("포스트잇 색깔 종류") → RAG 답변
  - 일반 ("오늘 뉴스") → 웹검색 답변
  - 일정 조회 ("오늘 일정") → 코드 포맷 즉시
  - 일정 등록 ("내일 회의 등록") → confirm 카드 → 승인 → DB INSERT
  - 거절 ("어제 회의 삭제") → 안내 메시지
- [ ] HTTPS 인증서 만료일 90일 이상 (`echo | openssl s_client -connect teamworks.example.com:443 2>/dev/null | openssl x509 -noout -dates`)
- [ ] DB 백업 cron 동작 (`/var/backups/teamworks/db-*.sql.gz` 누적)

## 10. 롤백 절차

### 10.1 코드 롤백

```bash
cd /opt/team-works
git log --oneline -5
git checkout <이전 커밋 SHA>
docker compose up -d --no-deps --force-recreate backend frontend
sudo systemctl restart teamworks-rag
```

### 10.2 DB 롤백

```bash
# 최근 백업으로 복구
docker compose exec -T db psql -U teamworks-manager -d teamworks -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c /var/backups/teamworks/db-YYYYMMDD.sql.gz | docker compose exec -T db psql -U teamworks-manager -d teamworks
```

### 10.3 첨부파일 storage 롤백 (S3 → Local)

S3 전환 후 문제 발생 시:
```bash
# env 만 토글 (origin files/ 보존되어 있어야 함)
sed -i 's/STORAGE_BACKEND: s3/STORAGE_BACKEND: local/' docker-compose.prod.override.yml
docker compose up -d --no-deps backend
```

## 11. 운영 가이드

### 11.1 일상 모니터링

```bash
docker compose ps                       # 컨테이너 상태
docker stats                            # CPU/RAM 사용률
df -h /                                 # 디스크
docker compose logs --tail 100 backend  # 최근 backend 로그
sudo journalctl -u teamworks-rag -f     # RAG 서버 실시간
sudo journalctl -u ollama -f            # Ollama
```

### 11.2 정기 작업

| 주기 | 작업 |
|------|------|
| 매일 | DB dump 자동 (§4.2) + S3 동기화 |
| 매주 | `docker system prune -af --volumes=false` (오래된 이미지 정리) |
| 매월 | DB 백업 복구 검증 (§4.3) |
| 분기 | 보안 패치 — `apt update && apt upgrade`, `docker compose pull` |
| 분기 | Open WebUI / Ollama 마이너 버전 업그레이드 (변경 사항 review 후) |
| 6개월 | 인증서 갱신 검증 (자동이지만 alert 확인) |

### 11.3 사고 대응

- **backend 502** → `docker compose logs backend` → 5xx 발생 시 컨테이너 재기동 (`docker compose restart backend`)
- **DB connection refused** → `docker compose ps db` 상태 확인 → 디스크 가득 여부(`df`) → 재기동
- **AI 답변 미응답** → Ollama 프로세스 확인(`systemctl status ollama`) → GPU 메모리 가득(`nvidia-smi`)
- **HTTPS 만료** → 자동 갱신 실패 시 수동 `certbot renew` + nginx restart

## 12. 위험 / 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| Ollama 모델이 RAM 점유 → OOM | AI 답변 끊김, 다른 컨테이너 영향 | `docker-compose.yml` 의 backend/frontend 에 `mem_limit` 설정. Ollama 단독 호스트로 분리(권장) |
| gemma4:26b 응답 30~120초 → 사용자 답답 | UX 저하 | GPU 사용 권장, SSE 스트리밍은 이미 적용 |
| `.env` 시크릿 노출 | 인증 우회·DB 탈취 | `chmod 600`, git ignore 확인, 호스트 SSH 키 회전 |
| Postgres 디스크 가득 → 쓰기 실패 | 서비스 중단 | 모니터링 알람 80% — 디스크 증설 |
| 자료실 첨부파일이 호스트 디스크만 사용 | 호스트 장애 시 손실 | S3 전환 (§6) — `STORAGE_BACKEND=s3` 토글 |
| Let's Encrypt 갱신 실패 | HTTPS 만료 → 사용자 접속 차단 | cron + alert. wildcard 인증서로 주기적 수동 발급 fallback |
| RAG 인덱스 재빌드 누락 | 답변 품질 저하 | `ollama/*.md` 변경 시 자동 재인덱싱 hook (git pre-receive 등) |
| Open WebUI v0.9 admin DB 손실 | 모델·웹검색·임베딩 우회 설정 모두 초기화 | `open-webui-data` volume 정기 백업 |
| 단일 호스트 장애 (디스크·네트워크) | 전체 서비스 중단 | 1단계는 수용. HA 도입 시 §13 후속 |

## 13. 후속 (이번 가이드 외)

- **HA 구성** — backend/frontend 다중 인스턴스 + nginx upstream 로드밸런싱. RAG·Ollama 별도 GPU 워커
- **CI/CD 자동화** — GitHub Actions 가 main push 시 호스트 SSH → `docker compose up -d`
- **로그 중앙 수집** — Loki + Grafana 또는 CloudWatch
- **APM** — Sentry, Datadog 같은 에러·성능 모니터링
- **DB 멀티 인스턴스** — 읽기 replica + PgBouncer
- **첨부파일 antivirus 스캔** — ClamAV 컨테이너 추가 후 storage adapter 안 검증 단계에 통합

## 14. 관련 문서

- [`docs/15-docker-container-gen.md`](./15-docker-container-gen.md) — 컨테이너 인프라 상세
- [`docs/13-RAG-pipeline-guide.md`](./13-RAG-pipeline-guide.md) — RAG 인덱스·재빌드
- [`docs/14-Open-WebUI-plan.md`](./14-Open-WebUI-plan.md) — Open WebUI / SearxNG admin 설정
- [`docs/16-mcp-server-plan.md`](./16-mcp-server-plan.md) — AI 4-way 분기
- [`docs/18-board-guide.md`](./18-board-guide.md) — 자료실·storage 추상화·S3 마이그레이션
