'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean; // 마이크로 녹음 중
  isTranscribing: boolean; // 녹음 종료 후 서버 STT 변환 중
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

// 자체 호스팅 Whisper 기반 STT.
// 브라우저 MediaRecorder 로 오디오 녹음 → /api/stt 로 업로드 → Whisper 변환 결과 수신.
//
// 자동 종료 (VAD): 사용자가 발화를 시작한 뒤 일정 시간 침묵하면 자동 stop → 즉시 변환 시작.
// (Google Web Speech API 의 단일 발화 모드와 유사한 UX)

const SILENCE_THRESHOLD_RMS = 0.015; // 0~1 normalized — 모바일 노이즈 고려한 보수적 값
const SILENCE_DURATION_MS = 1000; // 발화 후 이 시간 침묵 지속 시 auto-stop
const MAX_RECORDING_MS = 30000; // 안전망 — 침묵 감지 실패해도 30초 후 강제 stop
const VAD_TICK_MS = 100; // RMS 측정 주기

export function useWhisperRecognition(): UseSpeechRecognitionResult {
  const isSupported =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined';

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  // VAD 관련 ref
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heardVoiceRef = useRef(false);
  const silentSinceRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoStoppedRef = useRef(false);

  const cleanupVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    heardVoiceRef.current = false;
    silentSinceRef.current = null;
    autoStoppedRef.current = false;
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // 언마운트 시 모든 리소스 정리
  useEffect(() => {
    return () => {
      cleanupVAD();
      cleanupStream();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          /* noop */
        }
      }
      cancelledRef.current = true;
    };
  }, [cleanupVAD, cleanupStream]);

  // VAD 초기화 — stream 받아 AudioContext + AnalyserNode 구성, 주기적 RMS 측정.
  // 발화 감지 후 SILENCE_DURATION_MS 동안 무음이면 onSilence() 트리거.
  const setupVAD = useCallback((stream: MediaStream, onSilence: () => void) => {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // VAD 미지원 환경 — 자동 stop 없이도 manual stop 으로 동작

    const ctx = new Ctor();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;

    const buffer = new Float32Array(analyser.fftSize);
    vadIntervalRef.current = setInterval(() => {
      if (autoStoppedRef.current || !analyserRef.current) return;
      analyserRef.current.getFloatTimeDomainData(buffer);
      // RMS 계산 — 시간 영역 신호의 평균 에너지
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const now = Date.now();

      // 안전망 — MAX_RECORDING_MS 초과 시 강제 stop
      if (now - startTimeRef.current >= MAX_RECORDING_MS) {
        autoStoppedRef.current = true;
        onSilence();
        return;
      }

      if (rms >= SILENCE_THRESHOLD_RMS) {
        // 발화 감지 — 침묵 카운터 reset, "발화 시작됨" 마킹
        heardVoiceRef.current = true;
        silentSinceRef.current = null;
      } else {
        // 침묵 — 발화 시작 후에만 카운트
        if (!heardVoiceRef.current) return;
        if (silentSinceRef.current === null) {
          silentSinceRef.current = now;
        } else if (now - silentSinceRef.current >= SILENCE_DURATION_MS) {
          autoStoppedRef.current = true;
          onSilence();
        }
      }
    }, VAD_TICK_MS);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    cleanupVAD();
    setIsListening(false);
  }, [cleanupVAD]);

  const start = useCallback(async () => {
    if (isListening || isTranscribing || !isSupported) return;
    setError(null);
    setTranscript('');
    cancelledRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? '마이크 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.'
          : '마이크에 접근할 수 없습니다.';
      setError(msg);
      return;
    }
    streamRef.current = stream;

    const candidateTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    const mimeType = candidateTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      cleanupStream();
      setError('녹음을 시작할 수 없습니다.');
      return;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      cleanupVAD();
      cleanupStream();
      setIsListening(false);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];
      if (blob.size === 0 || blob.size < 4000) {
        // 너무 짧음 — 사용자 실수 탭 또는 발화 거의 없음. 변환 skip.
        return;
      }
      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append('audio', blob, `recording.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
        const res = await fetch('/api/stt', { method: 'POST', body: formData });
        if (cancelledRef.current) return;
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `STT 서버 오류 (${res.status})`);
        }
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        if (cancelledRef.current) return;
        setTranscript(text);
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : '음성 변환 실패');
      } finally {
        setIsTranscribing(false);
      }
    };

    recorder.onerror = () => {
      cleanupVAD();
      cleanupStream();
      setIsListening(false);
      setError('녹음 중 오류가 발생했습니다.');
    };

    try {
      recorder.start();
      startTimeRef.current = Date.now();
      setIsListening(true);
      // VAD 시작 — 침묵 감지되면 stop() 호출
      setupVAD(stream, () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          try {
            recorderRef.current.stop();
          } catch {
            /* noop */
          }
        }
        // setIsListening(false) 는 onstop 에서 처리됨
      });
    } catch {
      cleanupStream();
      setError('녹음을 시작할 수 없습니다.');
    }
  }, [isListening, isTranscribing, isSupported, cleanupStream, cleanupVAD, setupVAD]);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    cleanupVAD();
    cleanupStream();
    setIsListening(false);
    setIsTranscribing(false);
  }, [cleanupVAD, cleanupStream]);

  return { isSupported, isListening, isTranscribing, transcript, start, stop, reset, error };
}
