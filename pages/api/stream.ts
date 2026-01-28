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

    // v1 API provides stream_url directly
    if (track.stream_url) {
      console.log("Redirecting to stream_url");
      res.redirect(307, track.stream_url);
      return; // Don't return the result of redirect
    }

    // Fallback: Try the /stream endpoint
    console.log("Trying /stream endpoint...");
    try {
      const streamResponse = await axios.get(
        `https://api.soundcloud.com/tracks/${trackId}/stream`,
        {
          headers: {
            Authorization: `OAuth ${token}`,
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        },
      );

      if (streamResponse.headers.location) {
        console.log("Got redirect from /stream");
        res.redirect(307, streamResponse.headers.location);
        return;
      }

      if (streamResponse.data && typeof streamResponse.data === "string") {
        console.log("Got stream URL from response");
        res.redirect(307, streamResponse.data);
        return;
      }
    } catch (streamError: any) {
      if (
        streamError.response?.status === 302 &&
        streamError.response?.headers?.location
      ) {
        console.log("Got redirect from error response");
        res.redirect(307, streamError.response.headers.location);
        return;
      }
      console.error("Stream endpoint failed:", streamError.message);
    }

    console.error("No stream URL found");
    res.status(404).json({
      error: "No stream URL available",
    });
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
