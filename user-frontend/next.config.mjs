/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Bỏ qua kiểm tra lỗi khi build/dev để tăng tốc độ và giảm CPU
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Sử dụng bộ biên dịch SWC siêu nhanh
  swcMinify: true,
  experimental: {
    workerThreads: false,
    cpus: 1
  }
};

export default nextConfig;
