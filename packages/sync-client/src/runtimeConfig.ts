const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_SOCKET_PORT = "3001";

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getClientAppBase(currentOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (currentOrigin) {
    return trimTrailingSlash(currentOrigin);
  }

  return DEFAULT_APP_URL;
}

export function getClientSocketUrl(baseUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const appBase = getClientAppBase(baseUrl);

  try {
    const url = new URL(appBase);
    url.port = process.env.NEXT_PUBLIC_SOCKET_PORT || DEFAULT_SOCKET_PORT;
    return trimTrailingSlash(url.toString());
  } catch {
    return `http://localhost:${process.env.NEXT_PUBLIC_SOCKET_PORT || DEFAULT_SOCKET_PORT}`;
  }
}
