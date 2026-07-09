/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost/meteor_blast/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig