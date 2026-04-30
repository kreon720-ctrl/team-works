# TEAM WORKS RAG 파이프라인

`ollama/` 디렉토리의 문서들을 임베딩해 **gemma2:9b** 챗봇이 세밀한 절차·오류 메시지·버튼 이름까지 정확히 답하도록 돕는 검색증강(RAG) 구성입니다.

## 전제

- Ollama 런타임 실행 중 (`http://127.0.0.1:11434`).
- 모델 설치: `gemma2:9b`, `nomic-embed-text`.
  ```bash
  ollama pull gemma2:9b
  ollama pull nomic-embed-text
  ```
- Node.js 20+ 권장.

## 설치

```bash
cd rag
npm install
```

## 인덱싱 (오프라인 1회)

`ollama/**.md` 파일을 청크로 쪼개고 `nomic-embed-text`로 임베딩해 `data/chunks.json`에 저장합니다.

```bash
npm run index
```

문서를 수정하면 다시 실행하세요. 수백 청크 수준이라 수 초 ~ 수십 초 내 완료됩니다.

## 대화 (CLI)

```bash
npm run ask                  # 대화형 프롬프트
node ask.js "업무보고 어떻게 보내?"   # 1회성 질문
```

답변 아래에 참고한 청크 경로와 코사인 유사도가 표시됩니다.

## HTTP 서버

```bash
npm run server
```

- `GET  /health` → `{ ok: true, model: "gemma2:9b" }`
- `POST /chat` (JSON): `{ "question": "업무보고 어떻게 보내?", "topK": 3 }`
  - 응답: `{ "answer": "...", "sources": [{ "source_file", "section_path", "score" }, ...] }`

기본 포트 8787. `PORT=9000 npm run server` 로 변경 가능.

## 환경 변수

| 변수 | 기본값 |
|------|--------|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` |
| `EMBED_MODEL` | `nomic-embed-text` |
| `TOP_K`       | `3` |
| `PORT`        | `8787` |

> 채팅 모델은 환경 변수가 아니라 런타임에 Ollama `/api/ps` 로 자동 해석합니다 (`modelResolver.js`). 운영자가 채팅 가능한 모델 1개를 띄워두면 그 모델로 동작하고, 없으면 "AI 모델에 연결할 수 없습니다." 오류를 반환합니다.

## 구성 요소

| 파일 | 역할 |
|------|------|
| `chunker.js` | 마크다운을 섹션/Q&A 단위로 청킹 |
| `index.js`   | 청크 임베딩 후 `data/chunks.json` 저장 |
| `retriever.js` | 질문 임베딩 → 코사인 유사도 top-k 검색 |
| `promptBuilder.js` | Modelfile 페르소나 + 가드레일 + 검색 청크 조합 |
| `ollamaClient.js` | Ollama `/api/embed`, `/api/chat` 래퍼 |
| `modelResolver.js` | 런타임 채팅 모델 자동 해석 (Ollama `/api/ps` 조회) |
| `server.js`  | Express 기반 `/chat`, `/classify`, `/parse-schedule-*`, `/health` |
| `ask.js`     | CLI 대화 클라이언트 |
| `docs/classify-rules.md` | 의도 분류 정책 (LLM system prompt) — 운영자가 코드 변경 없이 편집 |

## 동작 원리 한눈에

1. 사용자 질문 → `nomic-embed-text`로 임베딩
2. `data/chunks.json`의 모든 청크와 코사인 유사도 계산 → 상위 3개 선택
3. 시스템 프롬프트 = Modelfile의 SYSTEM 블록 + 가드레일 + 검색된 3개 청크
4. `gemma2:9b` 호출 → 답변 반환

설계 문서: `docs/16-rag-plan.md`.
