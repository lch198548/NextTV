/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.doubanio.com",
      },
      {
        protocol: "https",
        hostname: "tncache1-f1.v3mh.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
