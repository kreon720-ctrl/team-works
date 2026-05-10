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
  transcript: string; // final + interim 합본 — 매 호출마다 누적이 아닌 현재 세션의 전체 텍스트
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

// Web Speech API 래퍼. SSR-safe (typeof window 체크). 모바일 한국어 입력 전제로 기본값 ko-KR.
// 한 세션 = start() ~ stop()/onend 까지. transcript 는 세션 시작 시 비워지고 결과 이벤트마다 갱신.
export function useSpeechRecognition({
  lang = 'ko-KR',
  continuous = true,
  interimResults = true,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionResult {
  const isSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // stop() 호출 후 도착하는 late onresult 를 무시하기 위한 플래그.
  // 사용자가 [전송] 누르고 STT 를 정리하는 순간 마지막 partial 결과가 비동기로 도착해
  // transcript 가 다시 채워지는 race 차단.
  const suppressNextResults = useRef(false);

  useEffect(() => {
    if (!isSupported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interimResults;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (suppressNextResults.current) return; // stop() 이후 늦게 도착한 결과 무시
      // 모든 result 의 첫 번째 alternative.transcript 를 이어붙여 현재 세션 전체 텍스트 구성.
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
      try {
        rec.abort();
      } catch {
        // 이미 종료된 인스턴스 — 무시
      }
      recognitionRef.current = null;
    };
  }, [isSupported, lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    setError(null);
    setTranscript('');
    suppressNextResults.current = false; // 새 세션 — 결과 수신 재개
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // 같은 인스턴스가 이미 시작된 경우 — 사용자 빠른 더블탭 방지용 안전장치
      setError('음성 인식을 시작할 수 없습니다.');
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    suppressNextResults.current = true; // late onresult 차단
    try {
      recognitionRef.current.stop();
    } catch {
      // 이미 종료
    }
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
    case 'aborted':
      // 정상 중단 (사용자 취소·페이지 이동) — 사용자에게 노출 안 함
      return '';
    default:
      return `음성 인식 오류 (${code})`;
  }
}
