import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const resolveStream = async (
  trackId: string,
  auth: SoundCloudAuthContext,
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const { proxy } = req.query;

  const trackResponse = await axios.get(
    `https://api.soundcloud.com/tracks/${trackId}`,
    {
      headers: {
        Authorization: auth.headerValue,
      },
      timeout: 10000,
    },
  );

  const track = trackResponse.data;

  if (track.access && track.access !== "playable") {
    return res.status(403).json({
      error: `Track access is ${track.access} (not playable)`,
    });
  }

  if (!track.streamable) {
    return res.status(403).json({
      error: "Track is not streamable",
    });
  }

  let finalStreamUrl = null;

  try {
    const streamsResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}/streams`,
      {
        headers: {
          Authorization: auth.headerValue,
        },
        timeout: 10000,
      },
    );

    const streams = streamsResponse.data || {};

    if (
      streams.http_mp3_128_url &&
      !String(streams.http_mp3_128_url).includes("preview")
    ) {
      finalStreamUrl = streams.http_mp3_128_url;
      console.log("Using http_mp3_128_url from /streams");
    } else if (
      streams.progressive &&
      !String(streams.progressive).includes("preview")
    ) {
      finalStreamUrl = streams.progressive;
      console.log("Using progressive stream from /streams");
    } else if (streams.hls_mp3_128_url) {
      finalStreamUrl = streams.hls_mp3_128_url;
      console.log("Using hls_mp3_128_url from /streams");
    }
  } catch (error: any) {
    console.warn("/streams endpoint failed:", error.message);
  }

  if (!finalStreamUrl && track.stream_url) {
    try {
      const streamResponse = await axios.get(track.stream_url, {
        headers: {
          Authorization: auth.headerValue,
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      finalStreamUrl =
        streamResponse.request.res.responseUrl || streamResponse.config.url;
    } catch (error: any) {
      console.warn("stream_url failed:", error.message);
    }
  }

  if (!finalStreamUrl) {
    try {
      const streamResponse = await axios.get(
        `https://api.soundcloud.com/tracks/${trackId}/stream`,
        {
          headers: {
            Authorization: auth.headerValue,
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        },
      );

      finalStreamUrl =
        streamResponse.request.res.responseUrl || streamResponse.config.url;
    } catch (error: any) {
      console.warn("Stream endpoint failed:", error.message);
    }
  }

  if (!finalStreamUrl) {
    console.error("No stream URL found");
    return res.status(404).json({
      error: "No stream URL available",
    });
  }

  if (proxy === "1") {
    const rangeHeader = req.headers.range;
    const proxyResponse = await axios.get(finalStreamUrl, {
      responseType: "stream",
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        Authorization: auth.headerValue,
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = proxyResponse.headers["content-type"];
    const contentLength = proxyResponse.headers["content-length"];
    const acceptRanges = proxyResponse.headers["accept-ranges"];
    const contentRange = proxyResponse.headers["content-range"];

    if (contentType) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    res.status(proxyResponse.status);
    proxyResponse.data.pipe(res);
    return;
  }

  return res.status(200).json({ streamUrl: finalStreamUrl });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("ETag", "");
  res.setHeader("Last-Modified", "0");

  const { trackId } = req.query;
  const overrideToken = process.env.SOUNDCLOUD_OAUTH_TOKEN;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  let auth = getSoundCloudAuthContext(overrideToken || req.cookies.soundcloud_token);

  if (!auth && !overrideToken) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    return await resolveStream(trackId, auth, req, res);
  } catch (error: any) {
    if (!overrideToken && [401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res);
        if (refreshedAuth) {
          return await resolveStream(trackId, refreshedAuth, req, res);
        }
      } catch (refreshError: any) {
        console.error(
          "Stream refresh failed:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error(
      "Stream error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired",
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to get stream",
    });
  }
}
