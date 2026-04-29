'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AIAssistantPanel } from '@/components/ai-assistant/AIAssistantPanel';

// 직접 URL(/ai-assistant?teamId=...&teamName=...) 접근 fallback.
// 정상 사용 흐름은 팀 페이지 우측 탭(AIAssistantPanel 임베드)이며,
// 이 페이지는 북마크·외부 링크 등으로 들어왔을 때 동일 UI 를 단독으로 띄운다.
function AIAssistantPageInner() {
  const sp = useSearchParams();
  const teamId = sp.get('teamId') ?? '';
  const teamName = sp.get('teamName') ?? '';
  return (
    <div className="h-screen flex flex-col">
      <AIAssistantPanel teamId={teamId} teamName={teamName} showHeader />
    </div>
  );
}

export default function AIAssistantPage() {
  return (
    <Suspense fallback={null}>
      <AIAssistantPageInner />
    </Suspense>
  );
}
