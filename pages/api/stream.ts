import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  console.log("Stream request - trackId:", trackId, "token exists:", !!token);

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get track info using v1 API
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      },
    );

    const track = trackResponse.data;
    console.log("Track:", track.title, "Streamable:", track.streamable);

    if (!track.streamable) {
      return res.status(403).json({
        error: "Track is not streamable",
      });
    }

    let finalStreamUrl = null;

    // Method 1: Try stream_url
    if (track.stream_url) {
      try {
        console.log("Following stream_url redirect...");
        const streamResponse = await axios.get(track.stream_url, {
          headers: {
            Authorization: `OAuth ${token}`,
          },
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        // After following redirects, get the final URL
        finalStreamUrl =
          streamResponse.request.res.responseUrl || streamResponse.config.url;
        console.log("Got final stream URL");
      } catch (error: any) {
        console.error("stream_url failed:", error.message);
      }
    }

    // Method 2: Try /stream endpoint
    if (!finalStreamUrl) {
      try {
        console.log("Trying /stream endpoint...");
        const streamResponse = await axios.get(
          `https://api.soundcloud.com/tracks/${trackId}/stream`,
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
          },
        );

        finalStreamUrl =
          streamResponse.request.res.responseUrl || streamResponse.config.url;
        console.log("Got final stream URL from /stream");
      } catch (error: any) {
        console.error("Stream endpoint failed:", error.message);
      }
    }

    if (!finalStreamUrl) {
      console.error("No stream URL found");
      return res.status(404).json({
        error: "No stream URL available",
      });
    }

    // Return the final stream URL as JSON instead of redirecting
    console.log("Returning stream URL");
    res.json({ streamUrl: finalStreamUrl });
  } catch (error: any) {
    console.error(
      "Stream error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      res.status(401).json({
        error: "Token expired",
      });
      return;
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to get stream",
    });
  }
}
