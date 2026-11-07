import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { createHash } from "crypto";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

type Transcoding = {
  url?: string;
  preset?: string;
  quality?: string;
  snipped?: boolean;
  format?: { protocol?: string; mime_type?: string };
};

type V2Track = {
  access?: string;
  media?: { transcodings?: Transcoding[] };
  track_authorization?: string;
};

const CLIENT_ID_TTL_MS = 60 * 60 * 1000;
const STREAM_URL_TTL_MS = 45 * 1000;
let cachedClientId: { value: string; expiresAt: number } | null = null;
let clientIdRequest: Promise<string> | null = null;
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const streamUrlRequests = new Map<string, Promise<string>>();

const discoverWebClientId = async (): Promise<string> => {
  if (cachedClientId && cachedClientId.expiresAt > Date.now()) {
    return cachedClientId.value;
  }
  if (clientIdRequest) return clientIdRequest;

  clientIdRequest = (async () => {
    const userAgent =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
    const homepage = await axios.get<string>("https://soundcloud.com", {
      headers: { "User-Agent": userAgent },
      timeout: 15000,
      responseType: "text",
    });
    const assetUrls = [
      ...homepage.data.matchAll(
        /src=["'](https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js)["']/g,
      ),
    ].map((match) => match[1]);

    for (const assetUrl of assetUrls) {
      try {
        const asset = await axios.get<string>(assetUrl, {
          headers: { "User-Agent": userAgent },
          timeout: 12000,
          responseType: "text",
        });
        const match = asset.data.match(/client_id\s*:\s*["']([^"']+)["']/);
        if (match?.[1]) {
          cachedClientId = {
            value: match[1],
            expiresAt: Date.now() + CLIENT_ID_TTL_MS,
          };
          return match[1];
        }
      } catch {
        // A single stale asset should not prevent checking the remaining assets.
      }
    }
    throw new Error("Could not find SoundCloud's current web client ID");
  })().finally(() => {
    clientIdRequest = null;
  });

  return clientIdRequest;
};

const resolveV2Stream = async (
  trackId: string,
  auth: SoundCloudAuthContext,
): Promise<string> => {
  const clientId = await discoverWebClientId();
  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
  const trackUrl = `https://api-v2.soundcloud.com/tracks/${encodeURIComponent(trackId)}`;
  const baseParams = { client_id: clientId, app_locale: "en" };
  const baseHeaders = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": userAgent,
  };
  const trackAttempts = [
    { params: baseParams, headers: baseHeaders },
    {
      params: baseParams,
      headers: { ...baseHeaders, Authorization: `OAuth ${auth.queryValue}` },
    },
    { params: { ...baseParams, oauth_token: auth.queryValue }, headers: baseHeaders },
  ];
  let trackResponse;
  let lastTrackError: any;
  for (const attempt of trackAttempts) {
    try {
      trackResponse = await axios.get<V2Track>(trackUrl, {
        ...attempt,
        timeout: 12000,
      });
      break;
    } catch (error: any) {
      lastTrackError = error;
      if (![401, 403].includes(error.response?.status)) throw error;
    }
  }
  if (!trackResponse) {
    const error: any = new Error(
      lastTrackError?.response?.data?.message ||
        lastTrackError?.response?.data?.error ||
        lastTrackError?.message ||
        "SoundCloud v2 track lookup failed",
    );
    error.status = lastTrackError?.response?.status || 502;
    error.response = lastTrackError?.response;
    throw error;
  }

  const track = trackResponse.data;
  if (track.access && track.access !== "playable") {
    const error: any = new Error(`Track access is ${track.access}`);
    error.status = 403;
    throw error;
  }

  const transcodings = (track.media?.transcodings || []).filter(
    (item) => item.url && !item.snipped,
  );
  const selected =
    transcodings.find(
      (item) =>
        item.format?.protocol === "hls" &&
        /aac/i.test(`${item.preset || ""} ${item.format.mime_type || ""}`),
    ) ||
    transcodings.find((item) => item.format?.protocol === "hls") ||
    transcodings.find((item) => item.format?.protocol === "progressive");

  if (!selected?.url) {
    const error: any = new Error("No playable SoundCloud v2 transcoding is available");
    error.status = 404;
    throw error;
  }
  if (!track.track_authorization) {
    const error: any = new Error("SoundCloud did not provide track authorization");
    error.status = 403;
    throw error;
  }

  const transcodingUrl = new URL(selected.url);
  transcodingUrl.searchParams.set("client_id", clientId);
  transcodingUrl.searchParams.set("track_authorization", track.track_authorization);

  let resolved;
  let lastResolveError: any;
  for (const headers of [
    { "User-Agent": userAgent },
    { "User-Agent": userAgent, Authorization: `OAuth ${auth.queryValue}` },
  ]) {
    try {
      resolved = await axios.get(transcodingUrl.toString(), {
        responseType: "stream",
        headers,
        maxRedirects: 5,
        timeout: 20000,
      });
      break;
    } catch (error: any) {
      lastResolveError = error;
      if (![401, 403].includes(error.response?.status)) throw error;
    }
  }
  if (!resolved) {
    const error: any = new Error(
      lastResolveError?.response?.data?.message ||
        lastResolveError?.response?.data?.error ||
        lastResolveError?.message ||
        "SoundCloud transcoding resolution failed",
    );
    error.status = lastResolveError?.response?.status || 502;
    error.response = lastResolveError?.response;
    throw error;
  }
  const finalUrl =
    resolved.request?.res?.responseUrl || resolved.config.url || transcodingUrl.toString();
  resolved.data.destroy?.();
  return finalUrl;
};

const getStreamUrl = async (trackId: string, auth: SoundCloudAuthContext) => {
  const tokenKey = createHash("sha256")
    .update(auth.queryValue)
    .digest("hex")
    .slice(0, 16);
  const cacheKey = `${tokenKey}:${trackId}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  if (cached) streamUrlCache.delete(cacheKey);

  const pending = streamUrlRequests.get(cacheKey);
  if (pending) return pending;

  const request = resolveV2Stream(trackId, auth)
    .then((url) => {
      streamUrlCache.set(cacheKey, {
        url,
        expiresAt: Date.now() + STREAM_URL_TTL_MS,
      });
      return url;
    })
    .finally(() => streamUrlRequests.delete(cacheKey));
  streamUrlRequests.set(cacheKey, request);
  return request;
};

const isAllowedSoundCloudMediaUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "api-v2.soundcloud.com") {
    return url.pathname.startsWith("/media/");
  }
  return (
    hostname === "sndcdn.com" ||
    hostname.endsWith(".sndcdn.com") ||
    hostname === "soundcloud.cloud" ||
    hostname.endsWith(".soundcloud.cloud")
  );
};

const makeMediaProxyUrl = (upstreamUrl: string) =>
  `/api/stream?url=${encodeURIComponent(upstreamUrl)}`;

const rewriteHlsManifest = (manifest: string, baseUrl: string) => {
  const proxyUri = (uri: string) => {
    if (!uri || uri.startsWith("data:")) return uri;
    try {
      const absoluteUrl = new URL(uri, baseUrl).toString();
      return isAllowedSoundCloudMediaUrl(absoluteUrl)
        ? makeMediaProxyUrl(absoluteUrl)
        : uri;
    } catch {
      return uri;
    }
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;
      if (!line.startsWith("#")) return proxyUri(line.trim());
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxyUri(uri)}"`);
    })
    .join("\n");
};

const proxyMediaRequest = async (
  req: NextApiRequest,
  res: NextApiResponse,
  upstreamUrl: string,
) => {
  if (!isAllowedSoundCloudMediaUrl(upstreamUrl)) {
    return res.status(400).json({ error: "Unsupported SoundCloud media URL" });
  }

  const upstream = await axios.get(upstreamUrl, {
    responseType: "stream",
    headers: req.headers.range ? { Range: req.headers.range } : undefined,
    maxRedirects: 5,
    timeout: 20000,
    validateStatus: (status) => status >= 200 && status < 500,
  });

  const resolvedUrl =
    upstream.request?.res?.responseUrl || upstream.config.url || upstreamUrl;
  if (!isAllowedSoundCloudMediaUrl(resolvedUrl)) {
    upstream.data.destroy?.();
    return res.status(502).json({ error: "SoundCloud redirected to an unsupported media host" });
  }
  if (upstream.status >= 400) {
    upstream.data.destroy?.();
    return res.status(upstream.status).json({ error: "SoundCloud media request failed" });
  }

  const contentType = String(upstream.headers["content-type"] || "");
  const isManifest =
    /mpegurl/i.test(contentType) ||
    /\.m3u8(?:$|\?)/i.test(resolvedUrl) ||
    new URL(resolvedUrl).pathname.endsWith("/stream/hls");

  if (isManifest) {
    const chunks: Buffer[] = [];
    let size = 0;
    const maxManifestBytes = 2 * 1024 * 1024;
    for await (const chunk of upstream.data as AsyncIterable<Buffer | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxManifestBytes) {
        upstream.data.destroy?.();
        return res.status(502).json({ error: "SoundCloud playlist is unexpectedly large" });
      }
      chunks.push(buffer);
    }
    const body = rewriteHlsManifest(Buffer.concat(chunks).toString("utf8"), resolvedUrl);
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(body);
  }

  for (const header of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const value = upstream.headers[header];
    if (value) res.setHeader(header, value);
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(upstream.status);
  upstream.data.on("error", (error: Error) => {
    console.error("SoundCloud media proxy error:", error.message);
    if (!res.headersSent) res.status(502);
    res.end();
  });
  upstream.data.pipe(res);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const { trackId, url } = req.query;

  if (typeof url === "string") {
    const auth = await getRequestSoundCloudAuthContext(req, res);
    if (!auth) return res.status(401).json({ error: "Not authenticated" });
    try {
      return await proxyMediaRequest(req, res, url);
    } catch (error: any) {
      const status = error.response?.status || 502;
      console.error("SoundCloud media proxy request failed:", status, error.message);
      if (res.headersSent) return res.end();
      return res.status(status).json({ error: "Unable to proxy SoundCloud media" });
    }
  }

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  let auth = await getRequestSoundCloudAuthContext(req, res);
  if (!auth) auth = await refreshSoundCloudAuth(req, res);
  if (!auth) return res.status(401).json({ error: "Not authenticated" });

  try {
    let streamUrl: string;
    try {
      streamUrl = await getStreamUrl(trackId, auth);
    } catch (error: any) {
      if (error.response?.status !== 401) throw error;
      const refreshedAuth = await refreshSoundCloudAuth(req, res, { force: true });
      if (!refreshedAuth) throw error;
      auth = refreshedAuth;
      streamUrl = await getStreamUrl(trackId, auth);
    }

    return res.status(200).json({
      streamUrl: makeMediaProxyUrl(streamUrl),
      contentType: "application/vnd.apple.mpegurl",
    });
  } catch (error: any) {
    const status = error.status || error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message || error.response?.data?.error || error.message;
    console.error("SoundCloud v2 stream error:", status, providerMessage);
    if (res.headersSent) return res.end();
    return res.status(status).json({
      error: providerMessage || "Failed to get stream",
      stage: error.response?.config?.url?.includes("api-v2.soundcloud.com/tracks/")
        ? "v2 track lookup"
        : "transcoding resolution",
    });
  }
}
