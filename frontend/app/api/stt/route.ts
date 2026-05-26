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

  // 도메인 어휘를 initial_prompt 로 주입 — 모델이 해당 단어 방향으로 편향되어 고유명사·기능명
  // 오인식 감소. 224 tokens 한도 안에서 핵심 명사·동사만 나열 (문장 형태 불필요).
  // 회사 업무 빈출 어휘 추가 — "그루밍"→"그러면" 류 한국어 LM 자동 보정 환각 완화.
  const INITIAL_PROMPT =
    '팀웍스 찰떡 일정 회의 프로젝트 자료실 포스트잇 공지 업무보고 등록 수정 삭제 조회 추가 변경 ' +
    '백로그 그루밍 스프린트 스크럼 데일리 위클리 리뷰 회고 마감 출시 런칭 미팅 약속';

  // language=ko: 한국어 강제. task=transcribe: 번역 아님. output=json: { text, segments }.
  // vad_filter=true: silero VAD 로 무음·소음 구간 제거 → 환각(없는 말 생성) 감소 + 응답 단축.
  // condition_on_previous_text=false: 이전 발화 컨텍스트로 다음 단어를 자동 추정·보정하는 기능 비활성.
  //   "그루밍"→"그러면" 같이 LM 이 더 빈도 높은 일반 단어로 끌어가는 환각 차단.
  const params = new URLSearchParams({
    language: 'ko',
    task: 'transcribe',
    output: 'json',
    vad_filter: 'true',
    initial_prompt: INITIAL_PROMPT,
    condition_on_previous_text: 'false',
  });
  const url = `${WHISPER_URL}/asr?${params.toString()}`;

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
