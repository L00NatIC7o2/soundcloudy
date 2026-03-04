/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove '@sparticuz/chromium' and 'puppeteer-core'
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
