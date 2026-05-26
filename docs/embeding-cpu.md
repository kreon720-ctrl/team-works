# 임베딩 모델 CPU 분리 가이드

> **누가 읽나요**: 운영 환경 (RTX 3070 8GB) 에서 Whisper turbo GPU 가속까지 적용 후 VRAM 헤드룸이 0 에 가까워진 운영자.
>
> **무엇을 다루나요**: `nomic-embed-text` 임베딩 모델을 GPU → CPU 로 분리해 VRAM ~0.5GB 확보. 코드 1줄 변경, 운영 절차 5단계, 검증·롤백 포함.
>
> **왜 안전한가**: 임베딩 모델은 137M 파라미터 (gemma4 의 ~30분의 1) — CPU 추론도 200-500ms 로 실용 범위. 사용자 체감 거의 없음.

---

## 1. 배경 — 왜 분리하는가

운영 환경 RTX 3070 (VRAM 8GB) 에 Whisper turbo (GPU) 까지 띄우면 VRAM 빠듯:

| 모델 | VRAM | 비고 |
|------|------|------|
| `gemma4-e4b-pure-q4` (chat) | ~6.5GB | 메인 LLM |
| `nomic-embed-text` (embedding) | ~0.55GB | RAG 검색용 |
| `whisper large-v3-turbo` (GPU) | ~1GB | 음성 STT |
| **합계** | **~8.05GB** | **OOM 위험 ⚠️** |

→ 임베딩만 CPU 로 옮기면:
| 분리 후 | VRAM | RAM |
|---------|------|------|
| GPU: gemma4 + Whisper | ~7.5GB | — |
| CPU: nomic-embed | 0 | +0.55GB |
| **헤드룸** | **0.5GB** | **충분** (16GB+ RAM 환경) |

---

## 2. 영향 분석

### 응답 속도 (`nomic-embed-text` 기준)
| 호출 위치 | GPU | CPU | 사용자 체감 |
|----------|------|------|----------|
| 사용법 질문 임베딩 (RAG `/chat`) | 50-100ms | 200-500ms | **거의 없음** (전체 RAG 응답 5-10초 중 일부) |
| 인덱스 빌드 (172 chunks) | ~10-15초 | ~1-3분 | **없음** (일회성, 운영 시 안 함) |

### 메모리
- **VRAM**: -0.55GB (GPU 부담↓)
- **RAM**: +0.55GB (호스트 RAM, 16GB+ 환경에서 부담 X)

### 안정성
- VRAM OOM 위험 ↓ (gemma4 + Whisper turbo 동시 안정 동작)
- 다른 GPU 모델 (큰 LLM 등) 로 swap 시 헤드룸 ↑

---

## 3. 현재 호출자 분석

`nomic-embed-text` 를 호출하는 곳:

| 호출자 | 파일 | 빈도 | 분리 영향 |
|--------|------|------|---------|
| **RAG 서버** (인덱스·query 임베딩) | `rag/ollamaClient.js` 의 `embed()` | 사용법 질문마다 1회 | **여기만 수정하면 됨** |
| Open WebUI (web search 임베딩) | `docker-compose.yml` 의 `RAG_EMBEDDING_MODEL` | **현재 미사용** — `BYPASS_EMBEDDING_AND_RETRIEVAL: "true"` 설정으로 호출 우회 | 영향 없음 |
| RAG 인덱스 빌드 (`npm run index`) | 같은 `embed()` 함수 사용 | 일회성 (수동 실행) | 자동으로 CPU 사용 |

→ **단일 진입점** (`embed()`) 만 수정하면 모든 임베딩이 CPU 로 분리됨.

---

## 4. 코드 변경 — 1줄 추가

**파일**: `rag/ollamaClient.js` (line 25-32)

### 변경 전
```js
export async function embed(model, input) {
  const data = await postJson("/api/embed", { model, input, keep_alive: KEEP_ALIVE_FOREVER });
  const vec = data.embeddings?.[0];
  if (!Array.isArray(vec)) {
    throw new Error(`embed: invalid response for model ${model}`);
  }
  return vec;
}
```

### 변경 후
```js
// 임베딩 모델은 CPU 로 분리 — VRAM 절약 (gemma4 + Whisper turbo 와 공존).
// num_gpu: 0 → Ollama 가 모든 layer 를 CPU 에 로드 (GPU 미사용).
// 작은 모델(137M)이라 CPU 추론도 200-500ms 로 실용 범위.
const EMBED_OPTIONS = { num_gpu: 0 };

export async function embed(model, input) {
  const data = await postJson("/api/embed", {
    model,
    input,
    keep_alive: KEEP_ALIVE_FOREVER,
    options: EMBED_OPTIONS,
  });
  const vec = data.embeddings?.[0];
  if (!Array.isArray(vec)) {
    throw new Error(`embed: invalid response for model ${model}`);
  }
  return vec;
}
```

`options.num_gpu: 0` 한 줄이 핵심. Ollama 의 모든 임베딩 호출이 CPU layer 로 전환됨.

---

## 5. 운영 환경 적용 절차 (Windows PowerShell)

### 5.1. 코드 받기
```powershell
cd C:\TeamWorks\team-works
git pull origin gemma4-adjust
```

### 5.2. 기존 GPU 로드된 nomic-embed 언로드
```powershell
# Ollama 가 nomic-embed 를 GPU 에 띄워두고 있으므로 강제 unload
curl -X POST http://127.0.0.1:11434/api/generate `
  -d '{\"model\":\"nomic-embed-text\",\"keep_alive\":0}'
# 또는 ollama 자체 stop 명령
ollama stop nomic-embed-text
```

### 5.3. RAG 서버 재기동
```powershell
# 기존 RAG 프로세스 종료
taskkill /F /IM node.exe /FI "WINDOWTITLE eq RAG*"

# 다시 시작
cd C:\TeamWorks\team-works\rag
npm run server
```

또는 STEP 5.5 의 통합 시작 스크립트 (`update.bat` / `start-rag.bat`) 재실행.

### 5.4. 첫 RAG 질문으로 nomic-embed CPU 로 새로 로드
브라우저에서 AI 찰떡이에게 사용법 질문 (예: "팀웍스 일정 등록 어떻게 해?") 한 번 던지면, RAG 서버가 `embed()` 호출 → Ollama 가 nomic-embed 를 **CPU 로 로드**.

### 5.5. (도커 컨테이너 변경 없음)
docker-compose.yml 변경 0. nginx, frontend, whisper, ollama 모두 재기동 불필요.

---

## 6. 검증

### 6.1. Ollama 메모리 상주 확인
```powershell
ollama ps
```

기대 출력 — `nomic-embed-text` 가 **`100% CPU`** 또는 **`SIZE_VRAM 0`** 으로 표시:
```
NAME                          ID       SIZE     PROCESSOR    UNTIL
gemma4-e4b-pure-q4:latest     ...      6.5 GB   100% GPU     Forever
nomic-embed-text:latest       ...      550 MB   100% CPU     Forever     ← CPU 로 분리됨
```

### 6.2. nvidia-smi 로 VRAM 절약 확인
```powershell
nvidia-smi --query-gpu=memory.used --format=csv
```

이전 ~8000 MiB → ~7500 MiB 수준으로 떨어져야 정상 (gemma4 + Whisper turbo 만 GPU).

### 6.3. RAG 동작 정상성
사용법 질문 응답 정상 (5-10초 안에 답변) + 출처 인용 표시 → OK.

응답 시간이 이전 대비 ~300ms 정도 늘 수 있지만 체감 거의 없음.

---

## 7. 롤백

`rag/ollamaClient.js` 의 `options: EMBED_OPTIONS` 한 줄 제거 (또는 git revert) → RAG 서버 재기동 → `nomic-embed-text` unload (위 5.2) → 다음 호출 시 자동으로 GPU 로드.

```powershell
cd C:\TeamWorks\team-works
git revert <CPU 분리 커밋 해시>
ollama stop nomic-embed-text
# RAG 서버 재기동
```

---

## 8. 주의 사항 / FAQ

### Q1. `OLLAMA_NUM_GPU=0` env 변수 쓰면 안 되나?
**안 됩니다**. 그건 **모든 모델**을 CPU 로 강제 → gemma4 까지 CPU 로 가서 답변 30-120초 걸림. 매 호출 옵션 명시 방식이 정답.

### Q2. Open WebUI 가 임베딩 호출하면?
현재 docker-compose.yml 에 `BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL: "true"` 와 `BYPASS_EMBEDDING_AND_RETRIEVAL: "true"` 가 설정돼 있어 Open WebUI 는 nomic-embed 를 호출하지 않습니다. 이 설정 끄면 Open WebUI 의 임베딩 호출은 GPU 로 갑니다 (별도 처리 필요).

### Q3. 첫 호출 cold-start 가 길어지나?
CPU 로드는 GPU 보다 약간 빠름 (모델이 작아서). 첫 호출 ~1-2초 추가는 비슷.

### Q4. 인덱스 빌드 (`npm run index`) 가 너무 느려지면?
172 chunks × ~500ms = ~1-3분. 운영 시 거의 실행 안 함 (ollama/*.md 변경 시만). 빌드 일회성으로 받아들이거나, 인덱스 빌드 시점만 임시로 GPU 로 돌리는 방법:
```powershell
# 임시로 코드 옵션 제거 → npm run index → 옵션 다시 추가
# 또는 한 번만 환경변수로 우회: 별도 ollamaClient_index.js 분리 (오버엔지니어링이라 비추)
```
실용적으로는 그냥 1-3분 기다리는 게 가장 단순.

### Q5. faster_whisper 처럼 Whisper 도 CPU 로 옮길 수 있나?
가능하지만 Whisper turbo (large-v3-turbo) 는 CPU 시 5-15초/요청 → voice command UX 망가짐. Whisper 는 GPU 유지가 맞고, **임베딩만 CPU 로 분리**하는 게 균형.

---

## 9. 효과 요약

| 항목 | Before | After |
|------|--------|-------|
| VRAM 점유 | ~8.0GB (꽉 참, OOM 위험) | **~7.5GB** (헤드룸 0.5GB) |
| RAM 점유 | — | +0.55GB |
| RAG 응답 시간 | 5-10초 | 5-10초 + ~300ms (체감 없음) |
| 인덱스 빌드 시간 | ~15초 | ~1-3분 (일회성) |
| 코드 변경 | — | `rag/ollamaClient.js` 1줄 |
| docker-compose 변경 | — | 없음 |
| 컨테이너 재기동 | — | 없음 (RAG 서버만) |

**결론**: 작은 부담으로 GPU 헤드룸 안정 확보. Whisper turbo 와 안정 공존 가능.

---

## 10. 관련 문서
- [`20-easy-deploy.md`](./20-easy-deploy.md) — 운영 배포 전체 가이드 (STEP 6.4 업데이트 절차)
- [`docker-compose.yml_bk`](./docker-compose.yml_bk) — 운영 GPU Whisper 전용 docker-compose 백업
- [`22-voice-input.md`](./22-voice-input.md) — Whisper STT 도입 가이드
- [`13-RAG-pipeline-guide.md`](./13-RAG-pipeline-guide.md) — RAG 파이프라인 전반
