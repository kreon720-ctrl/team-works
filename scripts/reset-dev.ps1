# =============================================================================
# reset-dev.ps1 — Team CalTalk 개발 환경 초기화 스크립트 (PowerShell)
#
# 수행 작업:
#   1. PostgreSQL DB 전체 초기화 (모든 데이터 삭제 후 스키마 재적용)
#   2. JWT 시크릿 재생성 (.env.local 업데이트) → 기존 토큰 자동 무효화
#
# 사용법:  powershell -ExecutionPolicy Bypass -File scripts\reset-dev.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ── 색상 출력 헬퍼 ─────────────────────────────────────────────────────────────
function Info($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Success($msg) { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Err($msg)     { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

# ── 경로 설정 ──────────────────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$EnvFile   = Join-Path $RootDir "backend\.env.local"
$SqlFile   = Join-Path $RootDir "database\reset-and-reapply.sql"

# psql 경로 탐색
$PsqlPaths = @(
    "C:\Program Files\PostgreSQL\18\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
)
$PsqlCmd = $PsqlPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $PsqlCmd) { Err "psql을 찾을 수 없습니다. PostgreSQL이 설치되어 있는지 확인하세요." }

# ── .env.local 파싱 ────────────────────────────────────────────────────────────
if (-not (Test-Path $EnvFile)) { Err ".env.local 파일을 찾을 수 없습니다: $EnvFile" }

$EnvContent  = Get-Content $EnvFile
$DatabaseUrl = ($EnvContent | Where-Object { $_ -match "^DATABASE_URL=" }) -replace "^DATABASE_URL=", ""
if (-not $DatabaseUrl) { Err "DATABASE_URL을 .env.local에서 찾을 수 없습니다." }

# postgresql://user:password@host:port/dbname 파싱
if ($DatabaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
    $DbUser = $Matches[1]
    $DbPass = [System.Uri]::UnescapeDataString($Matches[2])
    $DbHost = $Matches[3]
    $DbPort = $Matches[4]
    $DbName = $Matches[5]
} else {
    Err "DATABASE_URL 형식을 파싱할 수 없습니다: $DatabaseUrl"
}

# ── 확인 메시지 ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host "  ⚠  경고: 이 작업은 되돌릴 수 없습니다!" -ForegroundColor Red
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Red
Write-Host ""
Write-Host "  DB:  " -NoNewline; Write-Host $DbName -ForegroundColor Yellow -NoNewline; Write-Host " @ ${DbHost}:${DbPort}"
Write-Host ""
Write-Host "  수행 작업:"
Write-Host "    * 모든 테이블 삭제 후 스키마 재적용 (전체 데이터 삭제)"
Write-Host "    * JWT 시크릿 재생성 (기존 로그인 토큰 전체 무효화)"
Write-Host ""
$Confirm = Read-Host "  계속 진행하시겠습니까? (yes 입력)"
Write-Host ""

if ($Confirm -ne "yes") { Warn "취소되었습니다."; exit 0 }

# ── Step 1: DB 초기화 ──────────────────────────────────────────────────────────
Info "Step 1/2 — 데이터베이스 초기화 중..."

$env:PGPASSWORD = $DbPass
& $PsqlCmd -U $DbUser -d $DbName -h $DbHost -p $DbPort -f $SqlFile -q
if ($LASTEXITCODE -ne 0) { Err "DB 초기화 실패" }

Success "데이터베이스 초기화 완료"

# ── Step 2: JWT 시크릿 재생성 ──────────────────────────────────────────────────
Info "Step 2/2 — JWT 시크릿 재생성 중..."

$NewAccessSecret  = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
$NewRefreshSecret = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

$EnvContent = $EnvContent -replace "^JWT_ACCESS_SECRET=.*",  "JWT_ACCESS_SECRET=$NewAccessSecret"
$EnvContent = $EnvContent -replace "^JWT_REFRESH_SECRET=.*", "JWT_REFRESH_SECRET=$NewRefreshSecret"
$EnvContent | Set-Content $EnvFile -Encoding UTF8

Success "JWT 시크릿 재생성 완료"

# ── 완료 메시지 ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✓  초기화 완료!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  다음 단계:"
Write-Host "    1. 백엔드 서버를 재시작하세요  (JWT 시크릿 반영)"
Write-Host "    2. 브라우저에서 새로고침 → 자동으로 로그아웃됩니다"
Write-Host "    3. 새 계정으로 회원가입 후 사용하세요"
Write-Host ""
