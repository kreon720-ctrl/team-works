# 22. 음성 입력 (STT) 가이드 — 모바일 AI 찰떡이

> **누가 읽나요**: 모바일 AI 버틀러 화면에 음성 입력(Speech-to-Text) 을 도입할 프론트엔드 개발자.
>
> **무엇을 다루나요**: 기술 선택 근거(Web Speech API) → 아키텍처 → UX 사양 → 코드 스케치 → 에러 처리 → 한계와 향후 개선까지 한 호흡으로 청사진 정리. 본 문서는 **구현 직전 합의된 설계**이며, 실제 구현 시 그대로 따라가면 됩니다.
>
> **관련 문서**: AI 버틀러 전체 흐름은 [`5-tech-arch-diagram.md`](./5-tech-arch-diagram.md), 운영 환경 설정은 [`20-easy-deploy.md`](./20-easy-deploy.md).

---

## 1. 개요

모바일에서 AI 찰떡이 (`AIAssistantPanel`) 입력은 현재 텍스트 키보드만 가능. 이동 중·핸즈프리 상황에서 음성으로 일정 등록·조회를 빠르게 처리하기 위한 STT 입력 모드 도입.

**한 줄 요약**: 마이크 아이콘 탭 → 음성 발화 → 입력창 텍스트 자동 채움 → 사용자가 검토 후 [전송].

**적용 범위**: **모바일 AI 버틀러 탭 한정**. 데스크톱은 키보드로 충분, 일반 채팅이나 다른 화면에는 적용하지 않음.

---

## 2. 사용자 시나리오

### 시나리오 A — 일정 조회 (단일 발화)
1. 사용자가 모바일 AI 찰떡이 탭으로 이동
2. 입력창 우측의 마이크 아이콘 탭 → 빨간 펄스로 듣는 중 표시
3. "오늘 1시 일정 알려줘" 발화
4. 실시간 텍스트가 입력창에 표시됨 (interim → final)
5. 침묵 후 자동 종료 또는 사용자가 마이크 다시 탭
6. 사용자가 [전송] 버튼 또는 Enter → 기존 RAG 흐름 그대로

### 시나리오 B — 일정 등록 + 컨펌 (수동 클릭 유지)
1. 위 1~6 단계로 "오늘 3시 회의 일정 등록해줘" 전송
2. 컨펌 카드 (제목·일시 요약 + [승인] [취소] 버튼) 표시
3. **음성 명령으로 컨펌하지 않음** — 사용자가 직접 [승인] 또는 [취소] 탭

> 음성 → 컨펌 자동 트리거는 의도적으로 제외. 오인식으로 인한 실수 등록 위험 회피 + 구현 단순성. 향후 필요 시 별도 issue 로 검토.

### 시나리오 C — 오인식 수정
1. "내일 점심 약속" 발화했는데 "내일 전심 약속" 으로 인식
2. 입력창에서 키보드로 "전심" → "점심" 수정
3. [전송]

수동 전송 방식이라 오인식 즉시 교정 가능 — 자동 전송 방식 대비 큰 장점.

---

## 3. 기술 선택 — Web Speech API

### 후보 비교

| 옵션 | 의존성 | 비용 | Korean | 모바일 호환 | 정확도 | 결정 |
|------|--------|------|--------|------------|--------|------|
| **Web Speech API** | 0 (브라우저 내장) | 0 | ✓ `ko-KR` | iOS Safari 14.5+ / Android Chrome 둘 다 | OS native 엔진(Apple/Google) 위임 → 양호 | **채택** |
| Cloud STT (Google/Azure) | SDK + API key | 분당 $0.024 (Google) | ✓ | ✓ | 높음 | 보류 (비용·백엔드 작업) |
| Whisper.js (WASM) | wasm 모델 (~150MB+) | 0 | ✓ | 모바일 메모리 부담 | 매우 높음 | 보류 (모델 로딩) |

### Web Speech API 선택 이유

1. **0 의존성** — 브라우저 내장 (`SpeechRecognition` / `webkitSpeechRecognition`), npm 패키지 추가 불필요
2. **0 비용** — OS native 음성 엔진을 브라우저가 위임 호출
3. **Korean 지원** — `lang = 'ko-KR'` 한 줄로 한국어 인식
4. **모바일 우선 호환** — 사용 케이스가 모바일 한정이라 데스크톱 Firefox 비호환은 영향 없음

### 브라우저·기종 호환표 (2026-05 기준)

| 환경 | 지원 | 비고 |
|------|------|------|
| iOS Safari 14.5+ | ✓ | iOS 16+ 권장 (안정성) |
| Android Chrome | ✓ | 99.x+ |
| Android Samsung Internet | ✓ | 18+ |
| iOS WKWebView (PWA) | ✓ | iOS 16+ |
| 카카오톡 인앱 브라우저 | ⚠️ | 일부 미지원 (외부 브라우저 안내) |
| Firefox (모든 플랫폼) | ✗ | 마이크 아이콘 비표시 |
| 데스크톱 (전 브라우저) | — | 본 기능 적용 대상 외 |

**비지원 브라우저 처리**: feature detection (`'SpeechRecognition' in window || 'webkitSpeechRecognition' in window`) 으로 마이크 아이콘 자체를 렌더하지 않음. UI 깔끔, 사용자 혼란 최소화.

### 보안·권한

- **HTTPS 필수** — 운영 환경 이미 충족, localhost 도 허용
- **마이크 권한** — 첫 사용 시 브라우저 권한 다이얼로그 노출. 거부 시 toast 안내
- **녹음 데이터** — Web Speech API 가 OS 엔진에 위임, 우리 서버는 텍스트만 받음 (오디오 미저장)

---

## 4. 아키텍처

### 컴포넌트 다이어그램

```
┌──────────────────────────────────────────────┐
│ MobileLayout (parent)                         │
│  - enableVoiceInput={true} 고정 전달          │
│                                               │
│  ┌────────────────────────────────────────┐  │
│  │ AIAssistantPanel                       │  │
│  │                                        │  │
│  │  Composer:                             │  │
│  │   ┌─────────┐  ┌──────────┐            │  │
│  │   │textarea │  │ [전송]   │            │  │
│  │   │         │  │ [캘린더] │            │  │
│  │   │         │  │ [마이크] ←─ 신규       │  │
│  │   └─────────┘  └──────────┘            │  │
│  │       ↑              │                 │  │
│  │       │ setInput     │ click           │  │
│  │       │              ↓                 │  │
│  │       └──── useSpeechRecognition() ←───┤  │
│  │              (신규 hook)                │  │
│  │                ↓ start/stop             │  │
│  │       Web Speech API (브라우저)         │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 변경 파일

| 파일 | 변경 유형 | 역할 |
|------|---------|------|
| `frontend/hooks/useSpeechRecognition.ts` | **신규** | Web Speech API 래퍼 |
| `frontend/components/ai-assistant/AIAssistantPanel.tsx` | 수정 | 마이크 아이콘 + 훅 연결 |
| `frontend/app/(main)/teams/[teamId]/_components/MobileLayout.tsx` | 수정 | `enableVoiceInput` prop 전달 |

### 재사용

- 기존 캘린더 아이콘 hover 툴팁 패턴 (`AIAssistantPanel.tsx:680-702`) 그대로 차용
- 기존 `setInput`, `inputRef`, `sendQuestion` (`AIAssistantPanel.tsx:233-251`) 그대로 사용
- `useBreakpoint` 호출 불필요 — `MobileLayout` 자체가 모바일 전용 컨테이너

---

## 5. UX 사양

### 마이크 아이콘 위치

`AIAssistantPanel` composer 의 `flex flex-col gap-1.5 self-start` 컨테이너 내부, **캘린더 아이콘 바로 아래**.

```
[전송]      ← 기존
[캘린더]    ← 직전 PR 추가
[마이크]    ← 본 PR 추가
```

### 상태별 시각

| 상태 | 스타일 |
|------|--------|
| Idle (대기) | outline, 회색 마이크 SVG (`border border-gray-300`) |
| Listening (듣는 중) | `bg-red-500 text-white animate-pulse` |
| 비지원 브라우저 | 렌더 안 함 (자체 hide) |
| 오류 (권한 거부 등) | Idle 으로 복귀 + toast 메시지 |

### Hover 툴팁

상태별 다른 텍스트:
- Idle: `"음성 입력 시작"`
- Listening: `"음성 입력 중지"`

기존 캘린더 아이콘과 동일한 패턴(`absolute bottom-full mb-1 ... opacity-0 group-hover:opacity-100`).

### 인식 결과 표시

- `interimResults: true` — 발화 도중 실시간 텍스트가 입력창에 즉시 표시 (회색·기울임 등으로 구분 가능)
- `continuous: true` — 침묵 후 자동 종료, 사용자가 멈출 때까지 듣기
- 종료 시점: (a) 사용자가 마이크 다시 탭, (b) 일정 침묵 (브라우저 기본), (c) 다른 화면 이동

### 전송

**자동 전송 없음** — 인식 종료 후 텍스트가 입력창에 채워진 채 대기. 사용자가 [전송] 버튼 또는 Enter 로 명시적 전송.

---

## 6. 구현 코드 스케치

### 6.1. `useSpeechRecognition.ts` 골격

```ts
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;       // final + interim 합본
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

export function useSpeechRecognition({
  lang = 'ko-KR',
  continuous = true,
  interimResults = true,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  // SSR-safe feature detection
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (!isSupported) return;
    const Ctor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const rec: SpeechRecognition = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interimResults;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let combined = '';
      for (let i = 0; i < e.results.length; i++) {
        combined += e.results[i][0].transcript;
      }
      setTranscript(combined);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(mapErrorToKorean(e.error));
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    return () => {
      rec.abort();
      recognitionRef.current = null;
    };
  }, [isSupported, lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setError(null);
    setTranscript('');
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      setError('음성 인식을 시작할 수 없습니다.');
    }
  }, [isListening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { isSupported, isListening, transcript, start, stop, reset, error };
}

function mapErrorToKorean(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.';
    case 'no-speech':
      return '음성이 감지되지 않았습니다.';
    case 'audio-capture':
      return '마이크를 찾을 수 없습니다.';
    case 'network':
      return '네트워크 오류로 음성 인식에 실패했습니다.';
    default:
      return `음성 인식 오류 (${code})`;
  }
}
```

### 6.2. `AIAssistantPanel.tsx` — composer 추가 (요약 diff)

```tsx
// props interface 에 추가
interface AIAssistantPanelProps {
  // ... 기존
  enableVoiceInput?: boolean;
}

export function AIAssistantPanel({
  // ... 기존
  enableVoiceInput = false,
}: AIAssistantPanelProps) {
  // hook 호출
  const stt = useSpeechRecognition();

  // transcript 변경 시 입력창 sync
  useEffect(() => {
    if (stt.transcript) setInput(stt.transcript);
  }, [stt.transcript]);

  // 에러 토스트
  useEffect(() => {
    if (stt.error) {
      // 기존 toast/alert 패턴 사용 (혹은 setMessages 로 시스템 메시지)
    }
  }, [stt.error]);

  // composer 의 send/calendar 컨테이너 안, 캘린더 아이콘 다음에:
  {enableVoiceInput && stt.isSupported && (
    <div className="relative group">
      <button
        type="button"
        onClick={stt.isListening ? stt.stop : stt.start}
        className={`inline-flex items-center justify-center w-full rounded-lg py-1.5 px-3 transition-colors duration-150 ${
          stt.isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-dark-border dark:text-dark-text-muted dark:hover:bg-dark-elevated'
        }`}
        aria-label={stt.isListening ? '음성 입력 중지' : '음성 입력 시작'}
        aria-pressed={stt.isListening}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-14 0m7 7v3m-4 0h8M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        {stt.isListening ? '음성 입력 중지' : '음성 입력 시작'}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
      </div>
    </div>
  )}
```

### 6.3. `MobileLayout.tsx` — prop 전달

```tsx
// AIAssistantPanel 호출 2곳 (split 분기 분기 양쪽) 모두에 추가:
<AIAssistantPanel
  teamId={teamId}
  teamName={teamName}
  onToggleCalendar={...}
  enableVoiceInput  // ← 추가
/>
```

### 6.4. TypeScript 타입

`@types/dom-speech-recognition` 추가 또는 직접 선언 (`SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`). 현 시점 (TypeScript 5.x lib.dom) 기준 일부 타입이 누락되어 있을 수 있음 — 필요 시 `frontend/types/speech.d.ts` 에 최소 선언 추가:

```ts
// frontend/types/speech.d.ts
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}
```

---

## 7. 에러·예외 처리

| 상황 | 처리 |
|------|------|
| 마이크 권한 거부 (`not-allowed`) | toast: "마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요." → 마이크 아이콘 idle 복귀 |
| 침묵·음성 미감지 (`no-speech`) | toast: "음성이 감지되지 않았습니다." → idle 복귀, 입력창 이전 텍스트 보존 |
| 마이크 미발견 (`audio-capture`) | toast: "마이크를 찾을 수 없습니다." |
| 네트워크 오류 (`network`) | toast: "네트워크 오류로 음성 인식에 실패했습니다." (Web Speech API 가 일부 OS 에서 원격 엔진 호출 — 오프라인 시 발생 가능) |
| 페이지 이동·언마운트 | hook 의 cleanup 에서 `recognition.abort()` 자동 호출 |
| 듣는 중 사용자가 키보드로 입력 | listening state 유지, transcript 가 새로 들어오면 덮어쓰기 (의도된 단순화) — 향후 충돌 회피 로직 검토 |

---

## 8. 한계 및 향후 개선

### 한계
- **Firefox 미지원** — 데스크톱 Firefox 사용자에게는 마이크 아이콘이 안 보임 (모바일 한정 기능이라 영향 미미)
- **인앱 브라우저** — 카카오톡·페이스북 등 일부 인앱 브라우저는 SpeechRecognition 미구현. 외부 브라우저 안내 또는 비활성 (현재 자체 hide)
- **잡음 환경** — OS 엔진 의존이라 잡음 필터링 한계
- **네트워크 의존성** — 일부 OS·브라우저에서는 인터넷 연결이 필요할 수 있음

### 향후 개선 (별도 issue 화 권장)
1. **Whisper API 폴백** — 미지원 브라우저에 대해 서버 측 Whisper 호출
2. **음성 명령 매크로** — 컨펌 카드 음성 트리거 (이번 PR 에서 사용자 요청으로 제외) 재검토
3. **wake word** — "찰떡아" 호출로 자동 마이크 활성
4. **언어 선택** — `ko-KR` 외 영어 전환 (i18n 진행 시)
5. **음성 → 자동 의도 분류 + 즉시 실행** — 정확도 충분 검증 후 옵션화

---

## 부록 A. 참고 링크

- [MDN — Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [MDN — SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Can I use — SpeechRecognition](https://caniuse.com/speech-recognition) (브라우저 호환 실시간 확인)
- [W3C Web Speech API Spec](https://wicg.github.io/speech-api/)
