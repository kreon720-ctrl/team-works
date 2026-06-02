'use client';

import React, { useState } from 'react';
import { Button } from '@/components/common/Button';

interface TermsConsentDialogProps {
  open: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onAgree: () => void;
}

export const TERMS_CONSENT_STORAGE_KEY = 'teamworks_terms_consent_v1';
export const CURRENT_TERMS_VERSION = '2026-06-02';
export const CURRENT_PRIVACY_VERSION = '2026-05-29';

export interface TermsConsentPayload {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
}

export function hasStoredTermsConsent(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TERMS_CONSENT_STORAGE_KEY) === 'accepted';
}

export function storeTermsConsent(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TERMS_CONSENT_STORAGE_KEY, 'accepted');
}

export function getTermsConsentPayload(): TermsConsentPayload {
  return {
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  };
}

export function TermsConsentDialog({
  open,
  submitLabel = '동의하고 계속',
  onCancel,
  onAgree,
}: TermsConsentDialogProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  if (!open) return null;

  const canSubmit = termsAccepted && privacyAccepted;

  const handleAgree = () => {
    if (!canSubmit) return;
    storeTermsConsent();
    onAgree();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="terms-consent-title">
      <div className="max-h-[88vh] w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-dark-border dark:bg-dark-surface">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-dark-border">
          <h2 id="terms-consent-title" className="text-base font-semibold text-gray-900 dark:text-dark-text">
            약관 및 개인정보 동의
          </h2>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-dark-text-muted">
            Team Works를 처음 이용하려면 서비스 이용약관과 개인정보 수집 및 이용에 동의해야 합니다.
          </p>
        </div>

        <div className="max-h-[58vh] space-y-4 overflow-y-auto px-5 py-4 text-sm text-gray-700 dark:text-dark-text-muted">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text">[필수] Team Works 이용약관</h3>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-dark-border bg-dark-surface p-3 text-xs leading-5 text-dark-text shadow-inner">
              <p className="font-semibold text-white">TEAM WORKS 웹서비스 이용약관</p>

              <p className="mt-3 font-semibold text-white">제 1 장 총칙</p>
              <p className="mt-2 font-semibold text-dark-text">제 1 조 (목적)</p>
              <p>
                본 약관은 TEAM WORKS.co(이하 "회사"라 합니다)가 제공하는 TEAM WORKS 웹서비스(이하
                "서비스"라 합니다)의 이용조건 및 절차, 회원과 "회사"의 권리, 의무 및 책임사항 등 기타
                필요한 사항을 규정함을 목적으로 합니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 2 조 (약관의 명시와 개정)</p>
              <p>
                "회사"는 본 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면 또는 연결 화면에
                게시합니다. "회사"는 관계법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.
                약관을 개정할 경우에는 적용일자 및 개정사유를 명시하여 현행 약관과 함께 서비스 초기
                화면에 그 적용일자 7일(회원에게 불리한 변경은 30일) 전부터 적용일 전일까지 공지합니다.
                회원이 개정약관의 적용에 동의하지 않는 경우, 회원은 이용계약을 해지(회원탈퇴)할 수
                있습니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 3 조 (약관 외 준칙)</p>
              <p>
                본 약관에 명시되지 않은 사항은 전기통신기본법, 전기통신사업법, 정보통신망 이용촉진 및
                정보보호 등에 관한 법률 등 관계법령 또는 상관례에 따릅니다.
              </p>

              <p className="mt-3 font-semibold text-white">제 2 장 서비스 이용계약</p>
              <p className="mt-2 font-semibold text-dark-text">제 4 조 (이용계약의 성립)</p>
              <p>
                이용계약은 회원이 되고자 하는 자(이하 "가입신청자")가 약관의 내용에 대하여 동의를 한
                다음 회원가입 신청을 하고, "회사"가 이러한 신청에 대하여 승낙함으로써 성립합니다.
                "회사"는 가입신청자의 신청에 대하여 서비스 이용을 승낙함을 원칙으로 합니다. 다만,
                타인의 명의를 도용하거나 허위 정보를 기재한 경우 승낙을 거절하거나 사후에 계약을 해지할
                수 있습니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 5 조 (회원정보의 변경)</p>
              <p>
                회원은 개인정보관리화면을 통하여 언제든지 본인의 개인정보를 열람하고 수정할 수 있습니다.
                변경사항을 수정하지 않아 발생한 불이익에 대하여 "회사"는 책임지지 않습니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">
                제 6 조 (회원의 아이디 및 비밀번호 관리에 대한 의무)
              </p>
              <p>
                회원의 아이디와 비밀번호에 관한 관리책임은 회원에게 있으며, 이를 제3자가 이용하도록
                하여서는 안 됩니다. "회사"는 회원의 아이디가 개인정보 유출 우려가 있거나 반사회적 행동
                또는 미풍양속에 어긋나는 경우, 해당 아이디의 이용을 제한할 수 있습니다.
              </p>

              <p className="mt-3 font-semibold text-white">제 3 장 서비스 이용</p>
              <p className="mt-2 font-semibold text-dark-text">제 7 조 (서비스의 제공 및 변경)</p>
              <p>"회사"는 회원에게 다음과 같은 서비스를 제공합니다.</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>팀 생성, 팀 가입 신청 및 승인, 팀 정보 관리, 팀원 관리 등 팀 빌딩 및 운영 기능</li>
                <li>월·주·일 단위 일정 조회, 일정 등록·수정·삭제, 포스트잇 메모 등 스마트 캘린더 기능</li>
                <li>프로젝트, 프로젝트 일정, 세부 일정, 담당자, 기간, 진행률, 지연 상태 등을 관리하는 프로젝트 워크벤치 기능</li>
                <li>일자별 팀 채팅, 업무보고, 공지사항, 프로젝트별 채팅방 등 팀 커뮤니케이션 기능</li>
                <li>회의록, 보고서, 이미지, 문서 파일 등을 등록·조회·관리하는 일자별 및 프로젝트별 자료실 기능</li>
                <li>사용법 질문, 일반 질문, 일정 조회·등록·삭제·수정 등을 지원하는 AI 비서 "찰떡이" 기능</li>
                <li>음성을 텍스트로 변환하여 일정 요청, AI 비서 입력, 팀 채팅 메시지 입력 등에 활용할 수 있는 음성 입력 기능</li>
                <li>기타 "회사"가 추가 개발하거나 다른 회사와의 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스</li>
              </ol>
              <p className="mt-1">
                "회사"는 기술적 사양의 변경이나 운영상 필요에 따라 서비스의 전부 또는 일부를 변경하거나
                중단할 수 있으며, 이 경우 서비스 화면을 통해 사전에 공지합니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 8 조 (서비스의 중단)</p>
              <p>
                "회사"는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는 운영상 상당한
                이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수 있습니다. 천재지변, 전쟁,
                국가비상사태, 해결이 곤란한 기술적 결함 등 불가항력적인 사유로 서비스 제공이 불가능한
                경우 서비스 제공이 제한될 수 있습니다.
              </p>

              <p className="mt-3 font-semibold text-white">제 4 장 계약당사자의 의무</p>
              <p className="mt-2 font-semibold text-dark-text">제 9 조 ("회사"의 의무)</p>
              <p>
                "회사"는 관련법과 본 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고
                안정적으로 서비스를 제공하기 위하여 최선을 다하여 노력합니다. "회사"는 회원이 안전하게
                서비스를 이용할 수 있도록 개인정보보호를 위한 보안시스템을 갖추어야 하며, 개인정보처리방침을
                공시하고 준수합니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 10 조 ("회원"의 의무)</p>
              <p>회원은 서비스를 이용할 때 다음 행위를 하여서는 안 됩니다.</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>신청 또는 변경 시 허위내용의 등록</li>
                <li>타인의 정보도용</li>
                <li>"회사"가 게시한 정보의 변경</li>
                <li>"회사"가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시</li>
                <li>"회사" 및 기타 제3자의 저작권 등 지식재산권에 대한 침해</li>
                <li>"회사" 및 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                <li>외설적이거나 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
              </ol>

              <p className="mt-3 font-semibold text-white">제 5 장 계약 해지 및 이용 제한</p>
              <p className="mt-2 font-semibold text-dark-text">제 11 조 (계약해지 및 회원탈퇴)</p>
              <p>
                회원은 언제든지 서비스 내 마이페이지의 회원탈퇴 메뉴 등을 통하여 이용계약 해지 신청을 할
                수 있으며, "회사"는 관련법 등이 정하는 바에 따라 이를 즉시 처리하여야 합니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 12 조 (이용제한 등)</p>
              <p>
                "회사"는 회원이 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해하는 경우,
                경고, 일시정지, 영구이용정지 등으로 서비스 이용을 단계적으로 제한할 수 있습니다.
              </p>

              <p className="mt-3 font-semibold text-white">제 6 장 손해배상 및 기타사항</p>
              <p className="mt-2 font-semibold text-dark-text">제 13 조 (저작권의 귀속 및 이용제한)</p>
              <p>
                "회사"가 작성한 저작물에 대한 저작권 기타 지식재산권은 "회사"에 귀속합니다. 회원이 서비스
                내에 게시한 게시물의 저작권은 해당 게시물의 저작자에게 귀속됩니다. 단, "회사"는 서비스
                운영, 홍보 등의 목적으로 필요한 범위 내에서 해당 게시물을 무상으로 이용할 수 있습니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 14 조 (면책조항)</p>
              <p>
                "회사"는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는
                서비스 제공에 관한 책임이 면제됩니다. "회사"는 회원의 귀책사유로 인한 서비스 이용의 장애에
                대하여는 책임을 지지 않습니다. "회사"는 회원이 서비스와 관련하여 게재한 정보, 자료, 사실의
                신뢰도, 정확성 등의 내용에 관하여는 책임을 지지 않습니다.
              </p>
              <p className="mt-2 font-semibold text-dark-text">제 15 조 (준거법 및 재판관할)</p>
              <p>
                "회사"와 회원 간 제기된 소송은 대한민국법을 준거법으로 합니다. "회사"와 회원 간 발생한
                분쟁에 관한 소송은 민사소송법상의 관할법원을 전속관할로 합니다.
              </p>

              <p className="mt-3 font-semibold text-white">부칙</p>
              <p>본 약관은 2026년 06월 02일부터 적용됩니다.</p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text">[필수] 개인정보 수집 및 이용</h3>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-dark-border bg-dark-surface p-3 text-xs leading-5 text-dark-text shadow-inner">
              <p>
                Team Works는 회원 식별, 계정 생성, 로그인, 팀 생성 및 참여, 일정·프로젝트·채팅 등 서비스
                제공을 위해 필요한 최소한의 개인정보를 수집·이용합니다.
              </p>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="font-semibold text-white">수집 항목</dt>
                  <dd>이메일 주소, 이름 또는 닉네임, 비밀번호, 소셜 로그인 식별값, 프로필 이미지, 서비스 이용 기록, 접속 로그, 오류 기록</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">수집·이용 목적</dt>
                  <dd>회원가입 및 본인 식별, 로그인 및 계정 관리, 팀·일정·프로젝트·채팅 기능 제공, 고객 문의 대응, 보안 관리</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">보유·이용 기간</dt>
                  <dd>회원 탈퇴 시까지 보관 후 파기합니다. 단, 관계 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관합니다.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-white">동의 거부 안내</dt>
                  <dd>필수 항목에 동의하지 않을 경우 회원가입 및 Team Works 서비스 이용이 제한됩니다.</dd>
                </div>
              </dl>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-text">소셜 로그인 안내</h3>
            <p className="mt-2 text-xs leading-5">
              Google 또는 Kakao 계정으로 로그인하는 경우, Team Works는 사용자가 동의한 범위 내에서 이메일,
              이름 또는 닉네임, 프로필 이미지, 계정 식별값을 전달받아 회원가입, 로그인, 기존 계정 연결 및
              사용자 식별 목적으로 사용합니다.
            </p>
          </section>
        </div>

        <div className="space-y-3 border-t border-gray-200 px-5 py-4 dark:border-dark-border">
          <label className="flex items-start gap-2 text-xs font-medium text-gray-700 dark:text-dark-text-muted">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>[필수] Team Works 이용약관에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-xs font-medium text-gray-700 dark:text-dark-text-muted">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>[필수] 개인정보 수집 및 이용에 동의합니다.</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
              취소
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={!canSubmit} onClick={handleAgree}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
