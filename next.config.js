/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use 'mjs' extension or 'module.exports' depending on your project type
  reactStrictMode: true,

  /**
   * Required for Puppeteer/Chromium:
   * This prevents Next.js from trying to bundle these packages,
   * which would cause "Module not found" or bundle size errors
   * on Vercel/Serverless environments.
   */
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],

  // Optional: If you use domain-specific images from SoundCloud in your UI
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i1.sndcdn.com",
      },
      {
        protocol: "https",
        hostname: "a1.sndcdn.com",
      },
    ],
  },
};

module.exports = nextConfig;
