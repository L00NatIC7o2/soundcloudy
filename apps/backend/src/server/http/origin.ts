import type { NextApiRequest } from "next";

const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function getForwardedProto(req: NextApiRequest) {
  const value = req.headers["x-forwarded-proto"];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getForwardedHost(req: NextApiRequest) {
  const value = req.headers["x-forwarded-host"];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getRequestOrigin(req: NextApiRequest) {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const proto = getForwardedProto(req) || "http";
  const host = getForwardedHost(req) || req.headers.host;
  if (host) {
    return trimTrailingSlash(`${proto}://${host}`);
  }

  return DEFAULT_APP_URL;
}

export function getAuthCallbackUrl(req: NextApiRequest) {
  return `${getRequestOrigin(req)}/api/auth/callback`;
}

export function getAllowedCorsOrigin(req: NextApiRequest) {
  const origin = req.headers.origin;
  if (!origin) return null;

  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.ELECTRON_RENDERER_ORIGIN,
    ...(process.env.ALLOWED_CORS_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    ...DEFAULT_ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .map((value) => trimTrailingSlash(value as string));

  if (configured.includes(trimTrailingSlash(origin))) {
    return origin;
  }

  return null;
}
