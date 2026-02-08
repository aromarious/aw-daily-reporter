/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // 静的書き出しを有効化
  distDir: 'out',        // 出力先
  images: {
    unoptimized: true,    // ローカル配布・静的書き出しには必須
  },
  // 静的書き出し時は rewrites は無視されるが、
  // 開発環境 (npm run dev) でバックエンドを立てている間は機能する
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5602/api/:path*',
      },
    ]
  },
};

export default nextConfig;
