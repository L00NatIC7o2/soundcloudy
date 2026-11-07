import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getRequestSoundCloudWebCredentials,
  getSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

type Transcoding = {
  url?: string;
  preset?: string;
  duration?: number;
  snipped?: boolean;
  format?: { protocol?: string; mime_type?: string };
};

const DEFAULT_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";

const resolveV2Stream = async (
  trackId: string,
  auth: SoundCloudAuthContext | null,
  clientId: string,
) => {
  const trackUrl = `https://api-v2.soundcloud.com/tracks/${encodeURIComponent(trackId)}`;
  let track: any;

  try {
    const response = await axios.get(trackUrl, {
      params: { client_id: clientId },
      headers: auth ? { Authorization: auth.headerValue } : undefined,
      timeout: 10000,
    });
    track = response.data;
  } catch (error: any) {
    // Some tracks are only visible with the listener's OAuth credentials.
    if (!auth || ![401, 403].includes(error.response?.status)) throw error;
    const response = await axios.get(trackUrl, {
      params: { client_id: clientId, oauth_token: auth.queryValue },
      timeout: 10000,
    });
    track = response.data;
  }

  if (track.access && track.access !== "playable") {
    const error: any = new Error(`Track access is ${track.access} (not playable)`);
    error.status = 403;
    throw error;
  }

  const transcodings: Transcoding[] = Array.isArray(track.media?.transcodings)
    ? track.media.transcodings
    : [];
  const playable = transcodings.filter((item) => item.url && !item.snipped);
  // Progressive MP3 works with the browser audio element and supports byte ranges.
  // HLS is used when progressive audio is not offered for this track.
  const selected =
    playable.find(
      (item) =>
        item.format?.protocol === "progressive" &&
        item.format?.mime_type?.startsWith("audio/"),
    ) ||
    playable.find((item) => item.format?.protocol === "progressive") ||
    playable.find((item) => item.format?.protocol === "hls");

  if (!selected?.url) {
    const error: any = new Error("No playable SoundCloud v2 transcoding is available");
    error.status = 404;
    throw error;
  }

  const transcodingUrl = new URL(selected.url);
  transcodingUrl.searchParams.set("client_id", clientId);
  if (auth) transcodingUrl.searchParams.set("oauth_token", auth.queryValue);

  const response = await axios.get(transcodingUrl.toString(), {
    responseType: "stream",
    headers: auth ? { Authorization: auth.headerValue } : undefined,
    maxRedirects: 5,
    timeout: 15000,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const resolvedUrl =
    response.request?.res?.responseUrl || response.config.url || transcodingUrl.toString();
  response.data.destroy?.();
  return resolvedUrl;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const { trackId, proxy } = req.query;
  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  const overrideToken = process.env.SOUNDCLOUD_OAUTH_TOKEN;
  let auth = overrideToken
    ? getSoundCloudAuthContext(overrideToken)
    : await getRequestSoundCloudAuthContext(req, res);
  const webCredentials = await getRequestSoundCloudWebCredentials(req, res);
  const clientId = webCredentials?.clientId || process.env.SOUNDCLOUD_CLIENT_ID || DEFAULT_CLIENT_ID;

  if (!auth && !overrideToken) auth = await refreshSoundCloudAuth(req, res);
  if (!auth) return res.status(401).json({ error: "Not authenticated" });

  try {
    let streamUrl: string;
    try {
      streamUrl = await resolveV2Stream(trackId, auth, clientId);
    } catch (error: any) {
      if (overrideToken || error.response?.status !== 401) throw error;
      const refreshedAuth = await refreshSoundCloudAuth(req, res, { force: true });
      if (!refreshedAuth) throw error;
      auth = refreshedAuth;
      streamUrl = await resolveV2Stream(trackId, auth, clientId);
    }

    if (proxy !== "1") return res.status(200).json({ streamUrl });

    const upstream = await axios.get(streamUrl, {
      responseType: "stream",
      headers: req.headers.range ? { Range: req.headers.range } : undefined,
      timeout: 20000,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    if (upstream.status >= 400) {
      upstream.data.destroy?.();
      return res.status(upstream.status).json({
        error: upstream.status === 403
          ? "SoundCloud does not allow this track to be streamed."
          : "SoundCloud could not provide this stream.",
      });
    }

    for (const header of ["content-type", "content-length", "accept-ranges", "content-range"]) {
      const value = upstream.headers[header];
      if (value) res.setHeader(header, value);
    }
    res.status(upstream.status);
    upstream.data.on("error", (error: Error) => {
      console.error("SoundCloud stream proxy error:", error.message);
      if (!res.headersSent) res.status(502);
      res.end();
    });
    upstream.data.pipe(res);
  } catch (error: any) {
    const status = error.status || error.response?.status || 500;
    console.error("SoundCloud v2 stream error:", status, error.message);
    if (res.headersSent) return res.end();
    return res.status(status).json({
      error: error.response?.data?.message || error.message || "Failed to get stream",
    });
  }
}
