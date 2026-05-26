'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  isTranscribing: boolean; // Web Speech API 는 즉시 응답이라 실질적으론 false 만 반환
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

// 브라우저 내장 Web Speech API 기반 STT.
// 노트북 Chrome 은 Google 클라우드 STT (한국어 매우 강함) 위임 → 정확도·속도 모두 최상.
// 모바일 일부 quirk (Galaxy 자체 엔진 등) 는 본 hook 가 아닌 wrapper(useSpeechRecognition.ts)
// 단계에서 자체 Whisper 로 fallback 시킴.
//
// 본 hook 의 quirk 보정:
//   1) confidence === 0 결과 무시 — Android Chrome 의 중복 emit 차단
//      (react-speech-recognition 라이브러리의 검증된 워크어라운드)
//   2) cumulative 패턴 자동 감지 — 모든 인접 result 가 prefix 관계면 last 만 사용
//   3) continuous=false 단일 발화 + 자동 종료 (Web Speech API 가 침묵 감지 시 자동 stop)

const NOT_AVAILABLE_MSG = '음성 인식이 지원되지 않는 브라우저입니다.';

export function useWebSpeechRecognition(): UseSpeechRecognitionResult {
  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const suppressRef = useRef(false);

  useEffect(() => {
    if (!isSupported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'ko-KR';
    rec.continuous = false; // 단일 발화 — 침묵 감지 시 자동 stop (Web Speech API 자체 기능)
    rec.interimResults = true; // live preview (노트북에서 자연스러움)
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (suppressRef.current) return;
      if (e.results.length === 0) return;

      // confidence 0 인 결과는 Android Chrome 중복 quirk → 무시.
      // 단, isFinal=false (interim) 는 confidence 0 이 정상이라 통과.
      const validResults = Array.from({ length: e.results.length }, (_, i) => e.results[i]).filter(
        (r) => !r.isFinal || r[0].confidence > 0,
      );
      if (validResults.length === 0) return;

      // cumulative 감지 — 모든 인접 쌍에서 뒤가 앞을 prefix 로 포함하면 cumulative.
      let isCumulative = true;
      for (let i = 1; i < validResults.length; i++) {
        if (!validResults[i][0].transcript.startsWith(validResults[i - 1][0].transcript)) {
          isCumulative = false;
          break;
        }
      }

      let final = '';
      let interim = '';
      if (isCumulative) {
        const last = validResults[validResults.length - 1];
        if (last.isFinal) final = last[0].transcript;
        else interim = last[0].transcript;
      } else {
        for (const r of validResults) {
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
      }
      setTranscript(final + interim);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(mapErrorToKorean(e.error));
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [isSupported]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening || !isSupported) return;
    setError(null);
    setTranscript('');
    suppressRef.current = false;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError('음성 인식을 시작할 수 없습니다.');
    }
  }, [isListening, isSupported]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    suppressRef.current = true;
    try {
      recognitionRef.current.stop();
    } catch {
      /* noop */
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    suppressRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* noop */
      }
    }
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    isTranscribing: false, // Web Speech API 는 별도 변환 단계 없이 즉시 onresult
    transcript,
    start,
    stop,
    reset,
    error: !isSupported ? NOT_AVAILABLE_MSG : error,
  };
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
    case 'aborted':
      return '';
    default:
      return `음성 인식 오류 (${code})`;
  }
}
