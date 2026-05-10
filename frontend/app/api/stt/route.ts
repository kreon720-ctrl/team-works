import { NextRequest, NextResponse } from 'next/server';

// 자체 호스팅 Whisper STT 프록시.
// 클라이언트 (브라우저 MediaRecorder) → 본 라우트 → whisper 컨테이너.
// 같은 docker network 내부 호출이라 CORS 무관, 응답은 { text } 만 추려 단순화.

const WHISPER_URL = process.env.WHISPER_URL || 'http://127.0.0.1:9000';

// Whisper small 모델 + CPU 환경에서 짧은 음성(5-10초)도 처리에 수 초 걸릴 수 있어 여유롭게.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return NextResponse.json({ error: '오디오 데이터 파싱 실패' }, { status: 400 });
  }

  const audio = incomingForm.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: '오디오 파일이 비어 있습니다.' }, { status: 400 });
  }

  // Whisper API 는 'audio_file' 필드명 + multipart 를 기대.
  const upstreamForm = new FormData();
  upstreamForm.append('audio_file', audio, 'recording.webm');

  // language=ko 명시로 한국어 인식 강제 (auto-detect 보다 정확).
  // task=transcribe (기본) — 번역은 task=translate.
  // output=json 으로 { text, segments } 응답 받음.
  const url = `${WHISPER_URL}/asr?language=ko&task=transcribe&output=json`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { method: 'POST', body: upstreamForm });
  } catch (e) {
    return NextResponse.json(
      { error: 'Whisper 서버 호출 실패 — 컨테이너가 실행 중인지 확인해 주세요.' },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: `Whisper 서버 오류 (${upstream.status})`, detail },
      { status: 502 },
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ text: (data.text ?? '').trim() });
}
