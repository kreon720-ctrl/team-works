import type { NextConfig } from "next";

// dev 모드에서 LAN IP 등 외부 호스트로 접근 시 Next.js 가 _next/webpack-hmr 등
// dev 리소스를 cross-origin 으로 차단함. 접속 IP 를 명시 허용.
// (CIDR 미지원 — 호스트명·와일드카드 서브도메인만 인정. 새 호스트 추가 시 여기 명시)
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.219.50",
    "teamworks.my",
  ],
};

export default nextConfig;
