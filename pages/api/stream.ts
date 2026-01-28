import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get track info with Authorization header
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 5000,
      },
    );

    const track = trackResponse.data;
    console.log("Track:", track.title, "Streamable:", track.streamable);

    // Try to get stream URL
    let streamUrl = null;

    // Method 1: Direct stream_url
    if (track.stream_url) {
      streamUrl = track.stream_url;
    }
    // Method 2: Download URL if downloadable
    else if (track.download_url && track.downloadable) {
      streamUrl = track.download_url;
    }
    // Method 3: Try /stream endpoint with proper auth
    else {
      try {
        const streamResponse = await axios.get(
          `https://api.soundcloud.com/tracks/${trackId}/stream`,
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            maxRedirects: 0,
            validateStatus: (status) => status === 302 || status === 200,
          },
        );

        if (streamResponse.headers.location) {
          streamUrl = streamResponse.headers.location;
        }
      } catch (streamError: any) {
        if (streamError.response?.headers?.location) {
          streamUrl = streamError.response.headers.location;
        }
      }
    }

    if (!streamUrl) {
      console.error("No stream URL found for track:", trackId);
      return res.status(404).json({
        error: "Track is not streamable",
        details: {
          streamable: track.streamable,
          has_stream_url: !!track.stream_url,
          has_download_url: !!track.download_url,
        },
      });
    }

    console.log("Streaming track:", trackId);
    return res.redirect(307, streamUrl);
  } catch (error: any) {
    console.error(
      "Stream error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to get stream",
    });
  }
}
