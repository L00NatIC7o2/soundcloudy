/** @type {import('next').NextConfig} */
const configuredOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXTAUTH_URL,
  "https://unspleenish-nonpossessively-joanna.ngrok-free.dev",
];

const allowedDevOrigins = Array.from(
  new Set(
    configuredOrigins.flatMap((value) => {
      if (!value) return [];
      try {
        const url = new URL(value);
        return [value, url.host, url.hostname];
      } catch {
        return [value];
      }
    }),
  ),
);

const nextConfig = {
  allowedDevOrigins,
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
