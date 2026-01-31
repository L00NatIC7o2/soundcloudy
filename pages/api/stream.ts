import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { proxy } = req.query;
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
  const token = req.cookies.soundcloud_token;
  const overrideToken = process.env.SOUNDCLOUD_OAUTH_TOKEN;
  const authToken = overrideToken || token;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!authToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get track info using v1 API
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: {
          Authorization: `OAuth ${authToken}`,
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

    // Prefer /streams endpoint to pick a full-length progressive stream
    try {
      const streamsResponse = await axios.get(
        `https://api.soundcloud.com/tracks/${trackId}/streams`,
        {
          headers: {
            Authorization: `OAuth ${authToken}`,
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

    // Try stream_url next
    if (!finalStreamUrl && track.stream_url) {
      try {
        const streamResponse = await axios.get(track.stream_url, {
          headers: {
            Authorization: `OAuth ${authToken}`,
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

    // Try /stream endpoint as fallback
    if (!finalStreamUrl) {
      try {
        const streamResponse = await axios.get(
          `https://api.soundcloud.com/tracks/${trackId}/stream`,
          {
            headers: {
              Authorization: `OAuth ${authToken}`,
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
          Authorization: `OAuth ${authToken}`,
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

    res.status(200).json({ streamUrl: finalStreamUrl });
  } catch (error: any) {
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
