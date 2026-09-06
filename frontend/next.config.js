/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8001/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://127.0.0.1:8001/uploads/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
