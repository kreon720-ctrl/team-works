# Gemma 4 e4b (4-bit 양자화) — macOS · Ollama 설치 가이드

> **누가 읽나요**: macOS (Apple Silicon 또는 Intel) 에서 Hugging Face 의 Gemma 4 e4b GGUF 파일을 받아 Ollama 에 등록하고 TEAM WORKS / 일반 채팅에서 쓰고 싶은 사람.
>
> **무엇을 다루나요**: 다운로드 → 검증 → Modelfile 작성 → Ollama 등록 → 동작 확인 → 튜닝 → 제거까지 한 호흡.
>
> **시간**: 다운로드 5~15 분 (회선 속도) + 설정 5 분.
>
> **관련 문서**: 전체 배포 흐름은 [`20-easy-deploy.md`](./20-easy-deploy.md). 이 문서는 그 안의 STEP 2.1 을 macOS·e4b 단일 시나리오로 풀어 쓴 보조 가이드.

---

## 1. 왜 e4b 인가

Gemma 4 시리즈 중 **"e4b"** 는 약 4B 파라미터의 효율(efficient) 변종이고, 4-bit 양자화 GGUF (`q4_k_m` 권장) 형태로 받으면 **약 2.5~3 GB** 메모리만 점유합니다.

| 모델 | 파라미터 | 4-bit 점유 (대략) | 적정 환경 |
|---|---|---|---|
| **gemma4:e4b** | 4B | ~3 GB | M1/M2 8GB 이상, Intel Mac iGPU 도 가능 |
| gemma4:9b | 9B | ~6 GB | M1 Pro/M2 16GB 이상 |
| gemma4:26b | 26B | ~17 GB | M1 Max/Ultra 32GB+ |

이 가이드의 운영 시나리오 — **사내 운영용 게이밍 노트북 + 작은 모델로 빠른 응답** — 에는 e4b 가 가장 가성비 좋습니다. 큰 모델로 갈수록 정확도는 올라가지만 응답 속도가 느려져 사용자가 답답해함.

> **트레이드오프**: e4b 는 한국어 자연어 → JSON 변환 같은 정형 출력 (예: 일정 등록 인자 파싱) 에서 가끔 환각합니다. 본 프로젝트의 결정론적 가드 (서버 단 endAt 보정, 패널 단 multi-turn 재구성 등) 는 그 환각을 흡수하도록 설계되어 있습니다.

---

## 2. 사전 준비

다음이 모두 갖춰져 있어야 진행 가능. 빠진 게 있으면 채우고 오세요.

| 항목 | 확인 방법 | 부족할 때 |
|---|---|---|
| macOS 12+ (Monterey 이상) | 메뉴바 → 이 Mac에 관하여 | 시스템 업데이트 |
| 디스크 여유 5GB+ | `df -h /` | 정리 |
| 메모리 8GB+ (16GB 권장) | 메뉴바 → 이 Mac에 관하여 | — |
| Ollama 설치 | `ollama --version` | 아래 2.1 |
| 터미널 (Terminal.app / iTerm2) | Spotlight `⌘+Space` → "Terminal" | — |

### 2.1. Ollama 가 없을 때

**옵션 A — Homebrew (권장)**:
```bash
brew install ollama
```

**옵션 B — 공식 .zip**:
1. https://ollama.com/download → **Download for macOS** 클릭.
2. 받은 `Ollama-darwin.zip` 압축 해제 → 나온 `Ollama.app` 을 `Applications` 로 드래그.
3. `Ollama.app` 첫 실행 → 메뉴바에 라마 아이콘 표시.

검증:
```bash
ollama --version
# 예: ollama version is 0.4.x
```

> **부팅 시 자동 시작**: 시스템 설정 → 일반 → **로그인 항목** → `+` → `Ollama.app` 추가.
>
> **Apple Silicon (M1/M2/M3/M4)**: Metal 가속이 자동 활성화 — 별도 GPU 드라이버 설정 없음. Intel Mac 도 동작하지만 CPU 추론이라 e4b 도 토큰당 0.5~2 초 수준이 될 수 있음.

---

## 3. Hugging Face 에서 GGUF 다운로드

### 3.1. 모델 저장소 찾기

브라우저에서 https://huggingface.co 접속 → 상단 검색창에 **`gemma 4 e4b gguf`** 입력. 결과에서 다음 조건을 만족하는 저장소 선택:

- **GGUF 형식 파일을 직접 호스팅** (저장소명에 `-GGUF` 가 들어가면 거의 확실)
- **다운로드 수가 많고 최근 업데이트** (신뢰할 수 있는 quantizer 가 만든 파일)
- **README 에 양자화 표 (q4_0 / q4_k_m / q5_k_m / q8_0 등) 가 정리**

대표적 quantizer 계정 예:
- `unsloth/...-GGUF`
- `bartowski/...-GGUF`
- `lmstudio-community/...-GGUF`

(저장소 이름은 시간이 지나며 변경·이동될 수 있어 본 가이드는 특정 URL 을 박지 않습니다. 위 검색어로 가장 활발한 저장소를 고르세요.)

### 3.2. 라이선스 동의

Google 의 Gemma 시리즈는 **Gemma Terms of Use** 에 동의해야 다운로드가 활성화됩니다. Hugging Face 에서 처음 접근할 때:

1. 저장소 메인 페이지 상단의 **"You need to agree to share your contact information to access this model"** 박스 클릭.
2. Hugging Face 계정으로 로그인 (없으면 5초 가입).
3. 이름·소속·사용 목적 등 폼 작성 → **Submit**.
4. 즉시 또는 수 분 내 활성화 → **Files and versions** 탭의 다운로드 버튼이 살아남.

### 3.3. 양자화 변종 선택

같은 저장소 안에도 GGUF 파일이 여러 개 있습니다. 파일명 끝의 `q*` 부분이 **양자화 정밀도**:

| 파일명 패턴 | 의미 | 디스크 | 품질 | 추천 |
|---|---|---|---|---|
| `*q4_0.gguf` | 4-bit (단순) | 작음 | 낮음 | 메모리 빠듯할 때만 |
| **`*q4_k_m.gguf`** | **4-bit (k-quant medium)** | **작음** | **균형** | **★ 본 가이드 권장** |
| `*q5_k_m.gguf` | 5-bit | 중간 | 좋음 | 메모리 여유 있고 정확도 우선 |
| `*q8_0.gguf` | 8-bit | 큼 | 매우 좋음 | 큰 Mac 에서 디버깅용 |
| `*f16.gguf` | 비양자화 (FP16) | 매우 큼 | 원본 | e4b 도 8GB+ — 메모리 매우 여유 있을 때 |

**기본 추천**: `*q4_k_m.gguf` — 약 2.5~3 GB.

### 3.4. 다운로드

#### 옵션 A: 브라우저 (가장 단순)

1. 저장소 → **Files and versions** 탭 → 위에서 고른 `*q4_k_m.gguf` 행의 다운로드 아이콘 클릭.
2. 받은 파일을 `~/models/` 로 이동:
   ```bash
   mkdir -p ~/models
   mv ~/Downloads/gemma-4-e4b-q4_k_m.gguf ~/models/
   ```

#### 옵션 B: `huggingface-cli` (대용량·재개 가능, 권장)

큰 파일은 브라우저보다 `hf` CLI 가 안정적입니다.

```bash
# 한 번만 — Hugging Face CLI 설치
pip3 install -U huggingface_hub
# 또는 brew 가 있으면: brew install huggingface-cli
```

라이선스 동의가 필요한 모델은 **인증 토큰** 필요:

```bash
huggingface-cli login
# 프롬프트에서 토큰 붙여넣기 — 토큰은 https://huggingface.co/settings/tokens 에서 'Read' 권한으로 생성
```

다운로드 (저장소 ID 와 파일명 본인이 고른 걸로 치환):

```bash
huggingface-cli download <username>/<repo>-GGUF \
  gemma-4-e4b-q4_k_m.gguf \
  --local-dir ~/models \
  --local-dir-use-symlinks False
```

`--local-dir-use-symlinks False` 가 중요 — 빠뜨리면 cache 디렉토리에 심볼릭 링크만 생기고 실제 파일은 `~/.cache/huggingface/` 에 들어가서 나중에 정리가 헷갈립니다.

#### 옵션 C: `curl` (직접 URL)

저장소의 파일 페이지 → **download** 버튼 우클릭 → **링크 주소 복사**:

```bash
cd ~/models
curl -L -o gemma-4-e4b-q4_k_m.gguf \
  "https://huggingface.co/<username>/<repo>-GGUF/resolve/main/gemma-4-e4b-q4_k_m.gguf"
```

라이선스 동의가 필요한 모델은 위 URL 이 401 로 떨어집니다 — 토큰 헤더 추가:

```bash
curl -L -H "Authorization: Bearer $(cat ~/.cache/huggingface/token)" \
  -o gemma-4-e4b-q4_k_m.gguf \
  "https://huggingface.co/.../gemma-4-e4b-q4_k_m.gguf"
```

### 3.5. 파일 무결성 확인

다운로드 중간에 끊긴 파일이 있는지 확인:

```bash
ls -lh ~/models/gemma-4-e4b-q4_k_m.gguf
# → 표시된 크기가 저장소 README 의 q4_k_m 크기와 일치해야 함 (보통 2.5~3 GB)
```

저장소가 SHA256 을 제공하면 검증:

```bash
shasum -a 256 ~/models/gemma-4-e4b-q4_k_m.gguf
# → 출력 해시가 README 의 q4_k_m sha256 과 정확히 일치해야 함
```

크기/해시가 안 맞으면 다운로드 다시.

---

## 4. Modelfile 작성

Ollama 는 **`Modelfile`** 이라는 평문 설정 파일로 외부 GGUF 를 인식합니다. macOS 에서 가장 자주 발이 걸리는 부분이 **TextEdit 의 RTF 기본 저장 동작** — 그래서 `nano` 권장.

### 4.1. 권장: 터미널 + nano

```bash
mkdir -p ~/models
cd ~/models
nano Modelfile
```

편집기 화면에 아래 내용 붙여넣기 (사용자명·파일명 본인 환경으로 치환):

```dockerfile
# 다운로드한 GGUF 의 절대 경로 — '~' 사용 불가
FROM "/Users/사용자명/models/gemma-4-e4b-q4_k_m.gguf"

# 추론 파라미터 — 4.3 참고
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 8192

# 시스템 프롬프트 — 모델의 기본 톤·언어. 비워둬도 OK.
SYSTEM """
당신은 유능하고 친절한 AI 어시스턴트입니다. 한국어로 답변해 주세요.
"""
```

본인 사용자명 빠르게 확인:

```bash
echo /Users/$USER/models/gemma-4-e4b-q4_k_m.gguf
```

저장: `Ctrl+O` → Enter → `Ctrl+X`.

### 4.2. 대안: TextEdit (RTF 함정 주의)

TextEdit 으로도 작성 가능하지만 두 단계 추가 주의:

1. TextEdit 새 파일 → 메뉴 **포맷 → 일반 텍스트로 만들기** (`⌘+Shift+T`).
2. 위 4.1 의 내용 붙여넣기.
3. `⌘+S` → 위치 `~/models`, 이름 `Modelfile`, **"확장자 .txt 추가하지 않음"** 선택.
4. 저장 후 Finder 에서 파일을 보고 확장자가 표시되면 (예: `Modelfile.txt`) → 우클릭 **이름 변경** → 확장자 제거.

검증:

```bash
file ~/models/Modelfile
# → 'ASCII text' 또는 'UTF-8 Unicode text' 가 나와야 OK
# → 'rich text' / 'RTF' 가 나오면 다시 작성
```

### 4.3. PARAMETER 옵션 설명

| 옵션 | 의미 | 기본 권장 | 비고 |
|---|---|---|---|
| `temperature` | 무작위성 | 0.7 | 사실 응답 0.1~0.3, 창의 응답 0.8~1.0 |
| `top_p` | 누적 확률 임계 | 0.9 | 거의 0.9~0.95 고정 |
| `num_ctx` | 컨텍스트 윈도우 | 8192 | 대화 길이 짧으면 4096 으로 줄여 메모리 절약 |
| `num_predict` | 최대 출력 토큰 | — | 미설정 시 모델 기본값. RAG/JSON 파싱은 64~256 충분 |
| `repeat_penalty` | 반복 억제 | 1.1 | 한국어 답변이 같은 문장을 반복하면 1.2~1.3 시도 |

본 프로젝트의 RAG 서버는 호출 시점에 `temperature` 와 `num_predict` 를 override 하므로 (`rag/server.js`), Modelfile 의 PARAMETER 는 **Open WebUI 직접 사용 시의 기본값** 정도로 보면 됩니다.

### 4.4. SYSTEM 프롬프트

`SYSTEM """ ... """` 블록은 모든 대화의 첫 메시지처럼 동작. 한국어 답변을 강제하거나 어조를 잡고 싶을 때 유용. 비워두면 모델 본래 톤.

본 프로젝트에서는 RAG/parse 경로가 매 요청 자체 system prompt 를 보내므로 Modelfile 의 SYSTEM 은 **Open WebUI 일반 대화** 와 **`ollama run` 직접 사용** 에만 영향.

---

## 5. Ollama 에 등록

```bash
cd ~/models
ollama create gemma4:e4b -f Modelfile
```

Ollama 가:
1. Modelfile 을 파싱.
2. GGUF 를 자체 라이브러리 (`~/.ollama/models/blobs/`) 로 복사.
3. 태그 `gemma4:e4b` 로 등록.

진행 메시지가 `success` 로 끝나면 완료. 보통 30 초 ~ 1 분.

> **태그 이름은 자유**: `gemma4:e4b` 외에 `gemma4-mini` 등 본인이 알아볼 이름이면 OK. 단, **본 프로젝트 (TEAM WORKS) 가 자동 모델 감지 (`/api/ps`) 를 쓰므로 무엇이든 chat 가능 모델이면 동작** — 다만 다른 문서 (`20-easy-deploy.md` 등) 의 예시 명령과 일관되려면 `gemma4:e4b` 권장.

> **원본 GGUF 는 지워도 됨**: 등록 후 `~/models/gemma-4-e4b-q4_k_m.gguf` 는 Ollama 가 자체 폴더로 복사해뒀으므로 삭제 가능 — 디스크 회수.

---

## 6. 동작 확인

### 6.1. 등록 목록

```bash
ollama list
```

출력에 `gemma4:e4b` 가 보여야 함:
```
NAME                       ID              SIZE      MODIFIED
gemma4:e4b                 ab12cd34ef56    2.8 GB    1 minute ago
nomic-embed-text:latest    ...             274 MB    ...
```

### 6.2. 대화 모드

```bash
ollama run gemma4:e4b
```

프롬프트가 뜨면:
```
>>> 안녕? 한국어로 짧게 인사해줘.
```

답변이 토큰 단위로 흐르면 OK. `Ctrl+D` 로 종료.

### 6.3. API 직접 호출 (스크립트 검증용)

```bash
curl -sS http://127.0.0.1:11434/api/chat \
  -d '{
    "model": "gemma4:e4b",
    "messages": [{"role":"user","content":"한 단어로: hello 의 한국어"}],
    "stream": false
  }' | python3 -m json.tool
```

`message.content` 가 "안녕" 같은 한글이면 정상. 처음 호출은 모델 로드 때문에 5~20 초 걸리고, 두 번째부터 빠릅니다.

### 6.4. TEAM WORKS 와 연동 확인

이미 TEAM WORKS 를 띄워둔 상태라면 e4b 가 자동으로 잡힙니다 (RAG 서버의 `modelResolver.js` 가 매 호출마다 `/api/ps` 재해석):

```bash
curl -sS http://127.0.0.1:8787/health
# {"ok":true,"model":"gemma4:e4b"}
```

여러 모델이 동시에 떠있으면 `/api/ps` 의 첫 chat 모델이 선택됨 — 운영자는 **chat 모델 1 개만 떠있게** 유지 권장 (불필요한 모델은 `keep_alive=0` 으로 unload).

---

## 7. 성능 튜닝

### 7.1. 항상 메모리에 상주 (콜드 스타트 회피)

기본은 **5 분 idle 후 unload** — 다음 질문 때 다시 로드하느라 첫 답변이 5~20 초 느려짐. 운영용이면 영구 상주 권장:

```bash
# 단발 — 다음 unload 까지 무한 유지
curl -X POST http://127.0.0.1:11434/api/generate \
  -d '{"model":"gemma4:e4b","prompt":"hi","stream":false,"keep_alive":-1}'
```

영구 (재부팅에도 유지) — 환경변수 설정:

```bash
# zsh 사용자 (macOS 기본)
echo 'export OLLAMA_KEEP_ALIVE=-1' >> ~/.zshrc
source ~/.zshrc

# Ollama 재기동 — 메뉴바 라마 아이콘 → Quit → 다시 실행
```

확인:

```bash
ollama ps
# UNTIL 컬럼이 'Forever' 또는 '24 hours from now' 등이면 OK
```

### 7.2. 컨텍스트 길이 (`num_ctx`)

긴 대화·긴 문서 RAG 답변이 필요하면 Modelfile 의 `num_ctx` 를 16384 또는 32768 로 키움. 단 **메모리 점유 비례 증가** — `num_ctx=32768` 은 e4b 도 5~6 GB 까지 늘어남.

```dockerfile
PARAMETER num_ctx 16384
```

수정 후 재등록:
```bash
ollama create gemma4:e4b -f Modelfile
```

### 7.3. 메모리 부족 (Apple Silicon 16GB 미만)

`Activity Monitor` → 메모리 탭에서 압박 상황 확인. 빨간색이면:
- `num_ctx` 를 4096 으로 축소
- `keep_alive` 를 짧게 (예: `5m`)
- 다른 큰 앱 (Chrome 탭 다수, Xcode 등) 종료

---

## 8. 다른 모델로 교체 / 다중 모델 운영

### 8.1. 더 큰 모델 (gemma4:9b 등) 시도

같은 절차로 다른 GGUF 받아 등록. 두 모델 동시에 띄우면 메모리 부족 가능 — **하나씩 unload·load**:

```bash
# 9b 로드, e4b 자동 unload (LRU)
curl -X POST http://127.0.0.1:11434/api/generate \
  -d '{"model":"gemma4:9b","prompt":"hi","stream":false,"keep_alive":-1}'

# e4b 로드, 9b unload
curl -X POST http://127.0.0.1:11434/api/generate \
  -d '{"model":"gemma4:9b","keep_alive":0}'
curl -X POST http://127.0.0.1:11434/api/generate \
  -d '{"model":"gemma4:e4b","prompt":"hi","stream":false,"keep_alive":-1}'
```

본 프로젝트의 RAG 서버는 매 호출 `/api/ps` 재해석 (`rag/modelResolver.js`) 이라 — **모델 swap 시 RAG 서버 재기동 불필요**. 떠있는 모델로 자동 전환.

### 8.2. Modelfile 수정 후 재등록

PARAMETER 만 바꾸려면 GGUF 재다운로드 없이 같은 Modelfile 갱신 후 `ollama create` 다시:

```bash
nano ~/models/Modelfile     # 수정
ollama create gemma4:e4b -f ~/models/Modelfile     # 같은 태그로 덮어쓰기
```

---

## 9. 제거 / 재설치

### 9.1. 모델만 제거

```bash
ollama rm gemma4:e4b
```

→ Ollama 라이브러리에서 blob 삭제. `~/models/Modelfile` 과 원본 GGUF 는 별개 — 본인이 직접 정리.

### 9.2. 모든 Ollama 모델 보기

```bash
ollama list
du -sh ~/.ollama/models     # 총 디스크 점유
```

### 9.3. Ollama 자체 제거

```bash
# brew 로 설치한 경우
brew uninstall ollama

# .app 으로 설치한 경우
# Applications/Ollama.app 휴지통으로 이동
# 모델 데이터까지 지우려면:
rm -rf ~/.ollama
```

---

## 10. 트러블슈팅

### 10.1. `ollama create` 가 "no such file" 에러

```
Error: open Modelfile: no such file or directory
```

- 현재 디렉토리에 `Modelfile` 이 있는지 확인 (`ls`).
- 또는 `-f` 에 절대 경로 명시: `ollama create gemma4:e4b -f ~/models/Modelfile`.

### 10.2. `Modelfile` 파싱 에러 (RTF / BOM)

```
Error: invalid Modelfile
```

`file ~/models/Modelfile` 로 확인 → `rich text format` / `RTF` / `with BOM` 이면 4.2 절 다시. nano 로 새로 만드는 게 가장 빠름.

### 10.3. `ollama run` 이 "model not found"

```
Error: model 'gemma4:e4b' not found
```

- `ollama list` 에 정말 등록됐는지.
- 태그 정확히 일치 (`gemma4:e4b` ≠ `gemma4:E4B` ≠ `gemma4-e4b`).

### 10.4. 첫 호출이 너무 느림

처음엔 디스크 → 메모리 로드라 정상. 두 번째부터 빠르면 OK. 매번 느리면 **idle unload** 가 발생하는 것 — 7.1 의 `OLLAMA_KEEP_ALIVE=-1` 적용.

### 10.5. 한국어 답변이 깨지거나 영어로 답함

- Modelfile 의 SYSTEM 에 "한국어로 답변" 명시 (4.4).
- 양자화가 너무 낮을 수도 (`q4_0` → `q4_k_m` 또는 `q5_k_m` 으로 업그레이드 시도).

### 10.6. RAG 서버가 옛 모델 이름을 부른다

본 프로젝트 코드는 매 호출 재해석이라 발생 안 함. 만약 캐시된 옛 코드라면 RAG 서버 재기동:

```bash
pkill -f "node server.js"
cd /path/to/team-works/rag && npm run server
```

### 10.7. Apple Silicon 인데 "no GPU" 메시지

`ollama serve` 출력에 `using GPU` 가 안 보이면:
- macOS 12+ 인지 확인 (Metal 요구사항).
- Ollama 버전 최신화: `brew upgrade ollama` 또는 .app 재다운로드.
- 그래도 안 되면 Ollama GitHub Issues 검색.

---

## 11. 참고

- **Ollama 공식 Modelfile 문법**: https://github.com/ollama/ollama/blob/main/docs/modelfile.md
- **GGUF 양자화 가이드**: 각 quantizer 저장소의 README 가 가장 정확.
- **본 프로젝트의 모델 선택 로직**: [`rag/modelResolver.js`](../rag/modelResolver.js) — `/api/ps` 의 첫 non-embedding 모델을 매 호출 픽업.
- **본 프로젝트의 결정론적 가드** (e4b 환각 흡수):
  - [`rag/server.js`](../rag/server.js) — `endAt > startAt` 검증, AM/PM 모호 시 후속 질문 강제 등.
  - [`frontend/components/ai-assistant/AIAssistantPanel.tsx`](../frontend/components/ai-assistant/AIAssistantPanel.tsx) — multi-turn 결정론적 재구성.
