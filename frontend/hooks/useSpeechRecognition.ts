'use client';

import { useMemo } from 'react';
import { useWebSpeechRecognition } from './useWebSpeechRecognition';
import { useWhisperRecognition } from './useWhisperRecognition';

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

// 브라우저·디바이스별 STT 엔진 자동 선택:
//   Whisper 로 fallback:
//     - Samsung Internet (UA: SamsungBrowser) — 자체 음성 엔진 quirk
//     - Samsung Galaxy 디바이스 (UA: SM-XXXX) — Chrome 으로 접속해도 OS 가 Samsung 음성
//       엔진을 RecognitionService 로 위임할 가능성 (One UI 기본 설정). Galaxy Flip/Fold/S/A
//       모든 라인 포함. 사용자가 시스템 음성 엔진을 Google 로 변경했다면 Web Speech 로도 OK
//       이지만, 디폴트가 Samsung 인 경우가 많아 Whisper 우회가 안전.
//     - Web Speech API 자체 미지원 (Firefox 등)
//   Web Speech API:
//     - 노트북 Chrome (Mac/Win/Linux): Google 클라우드 STT — 한국어 정확도 ★★★★★
//     - iOS Safari/Chrome: Apple 음성 엔진 (Siri 동급)
//     - Galaxy 외 Android Chrome: Google Speech Services + confidence filter
//
// 두 hook 모두 항상 호출 (Rules of Hooks). 비활성 hook 은 사용자가 start() 호출 안 하면
// 리소스 점유 0 — 무해.
function selectEngine(): 'webspeech' | 'whisper' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'whisper';
  const ua = navigator.userAgent;
  // Samsung Internet (브라우저 앱 자체)
  if (/SamsungBrowser/i.test(ua)) return 'whisper';
  // Samsung Galaxy 디바이스 (Chrome 등 다른 브라우저여도 OS 음성 엔진 quirk 회피)
  // SM-XXXX 패턴: SM-G(폰), SM-F(Flip/Fold), SM-A(A시리즈), SM-N(Note), SM-T(Tab) 등 모두 포함
  if (/\bSM-[A-Z]\d{3,4}/i.test(ua)) return 'whisper';
  // Web Speech API 자체 미지원
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return 'whisper';
  return 'webspeech';
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const engine = useMemo(selectEngine, []);
  const webSpeech = useWebSpeechRecognition();
  const whisper = useWhisperRecognition();
  return engine === 'webspeech' ? webSpeech : whisper;
}
