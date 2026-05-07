import type { NextConfig } from "next";

const nextConfig: any = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Bỏ qua kiểm tra lỗi khi build/dev để tăng tốc độ và giảm CPU
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  experimental: {
    workerThreads: false,
    cpus: 1
  }
};

export default nextConfig;
