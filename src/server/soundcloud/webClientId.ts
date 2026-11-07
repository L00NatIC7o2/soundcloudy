import axios from "axios";

const CLIENT_ID_TTL_MS = 60 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

let cachedClientId: { value: string; expiresAt: number } | null = null;
let clientIdRequest: Promise<string> | null = null;

export const getSoundCloudWebClientId = async (fallback?: string) => {
  if (cachedClientId && cachedClientId.expiresAt > Date.now()) {
    return cachedClientId.value;
  }
  if (clientIdRequest) return clientIdRequest;

  clientIdRequest = (async () => {
    try {
      const homepage = await axios.get<string>("https://soundcloud.com/", {
        headers: { "User-Agent": USER_AGENT },
        responseType: "text",
        timeout: 15000,
      });
      const scriptTags = [
        ...homepage.data.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi),
      ];
      const assetUrls = scriptTags
        .map((match) => {
          try {
            return new URL(match[2], "https://soundcloud.com/");
          } catch {
            return null;
          }
        })
        .filter(
          (url): url is URL =>
            Boolean(
              url &&
                (url.hostname === "a-v2.sndcdn.com" ||
                  url.hostname.endsWith(".sndcdn.com")) &&
                url.pathname.includes("/assets/") &&
                /\.js$/i.test(url.pathname),
            ),
        )
        .reverse();

      for (const assetUrl of assetUrls) {
        try {
          const asset = await axios.get<string>(assetUrl.toString(), {
            headers: { "User-Agent": USER_AGENT },
            responseType: "text",
            timeout: 12000,
          });
          const match = asset.data.match(
            /(?:^|[^\w$])client_id\s*:\s*["']([a-zA-Z0-9_-]{16,128})["']/,
          );
          if (match?.[1]) {
            cachedClientId = {
              value: match[1],
              expiresAt: Date.now() + CLIENT_ID_TTL_MS,
            };
            return match[1];
          }
        } catch {
          // A stale or inaccessible bundle should not prevent trying others.
        }
      }
      throw new Error("Could not find SoundCloud's current web client ID in its JS assets");
    } catch (error) {
      const configured =
        process.env.SOUNDCLOUD_V2_CLIENT_ID || process.env.SOUNDCLOUD_CLIENT_ID;
      if (configured || fallback) return configured || fallback!;
      throw error;
    }
  })().finally(() => {
    clientIdRequest = null;
  });

  return clientIdRequest;
};
