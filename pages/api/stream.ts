import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getRequestSoundCloudWebCredentials,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

type StreamCollection = {
  hls_aac_160_url?: string;
  hls_aac_96_url?: string;
  hls_mp3_128_url?: string;
  http_mp3_128_url?: string;
};

const FALLBACK_CLIENT_ID = "BecG5WJDDxYMffAfWcjJleNqrGyJyZhI";

const toTrackUrn = (trackId: string) => {
  if (trackId.startsWith("soundcloud:tracks:")) return trackId;
  if (/^\d+$/.test(trackId)) return `soundcloud:tracks:${trackId}`;
  return trackId;
};

const resolvePublicStream = async (
  trackId: string,
  auth: SoundCloudAuthContext,
  clientIds: string[],
) => {
  const urn = toTrackUrn(trackId);
  const encodedUrn = encodeURIComponent(urn);
  const url = `https://api.soundcloud.com/tracks/${encodedUrn}/streams`;
  let lastError: any;

  for (const clientId of clientIds) {
    for (const useQueryToken of [false, true]) {
      try {
        const params: Record<string, string> = { client_id: clientId };
        const headers: Record<string, string> = {
          Authorization: `OAuth ${auth.queryValue}`,
          Accept: "application/json, text/plain, */*",
        };
        if (useQueryToken) {
          params.oauth_token = auth.queryValue;
          delete headers.Authorization;
        }

        const response = await axios.get<StreamCollection>(url, {
          params,
          headers,
          timeout: 12000,
        });
        const streams = response.data || {};
        const streamUrl =
          streams.hls_aac_160_url ||
          streams.hls_aac_96_url ||
          streams.hls_mp3_128_url ||
          streams.http_mp3_128_url;
        if (!streamUrl) {
          const error: any = new Error("SoundCloud returned no playable stream for this track");
          error.status = 404;
          throw error;
        }

        // Resolve SoundCloud's short-lived API URL immediately, so the player
        // receives the signed CDN URL rather than a URL that expires later.
        const resolved = await axios.get(streamUrl, {
          responseType: "stream",
          headers: { Authorization: `OAuth ${auth.queryValue}` },
          maxRedirects: 5,
          timeout: 15000,
        });
        const finalUrl =
          resolved.request?.res?.responseUrl || resolved.config.url || streamUrl;
        resolved.data.destroy?.();
        return finalUrl;
      } catch (error: any) {
        lastError = error;
        if (error.status === 404) throw error;
        if (![401, 403].includes(error.response?.status)) throw error;
      }
    }
  }

  const error: any = new Error(
    `SoundCloud stream lookup failed: ${lastError?.response?.data?.message || lastError?.message || "Unauthorized"}`,
  );
  error.status = lastError?.response?.status || 502;
  throw error;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const { trackId } = req.query;
  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  let auth = await getRequestSoundCloudAuthContext(req, res);
  if (!auth) auth = await refreshSoundCloudAuth(req, res);
  if (!auth) return res.status(401).json({ error: "Not authenticated" });

  const webCredentials = await getRequestSoundCloudWebCredentials(req, res);
  const clientIds = [...new Set([
    webCredentials?.clientId,
    process.env.SOUNDCLOUD_CLIENT_ID,
    FALLBACK_CLIENT_ID,
  ].filter((value): value is string => Boolean(value)))];

  try {
    let streamUrl: string;
    try {
      streamUrl = await resolvePublicStream(trackId, auth, clientIds);
    } catch (error: any) {
      if (error.status !== 401 && error.response?.status !== 401) throw error;
      const refreshedAuth = await refreshSoundCloudAuth(req, res, { force: true });
      if (!refreshedAuth) throw error;
      auth = refreshedAuth;
      streamUrl = await resolvePublicStream(trackId, auth, clientIds);
    }
    return res.status(200).json({ streamUrl, contentType: "application/vnd.apple.mpegurl" });
  } catch (error: any) {
    const status = error.status || error.response?.status || 500;
    console.error("SoundCloud public stream error:", status, error.message);
    if (res.headersSent) return res.end();
    return res.status(status).json({
      error: error.response?.data?.message || error.message || "Failed to get stream",
    });
  }
}
