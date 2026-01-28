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
    // Get track info with Authorization header
    console.log("Fetching track info...");
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
    console.log("Track found:", track.title, "Streamable:", track.streamable);

    // Check if track is streamable
    if (!track.streamable) {
      return res.status(403).json({
        error: "Track is not streamable",
      });
    }

    let streamUrl = null;

    // Method 1: Direct stream_url (most common)
    if (track.stream_url) {
      streamUrl = track.stream_url;
      console.log("Using stream_url");
    }
    // Method 2: Download URL if downloadable
    else if (track.download_url && track.downloadable) {
      streamUrl = track.download_url;
      console.log("Using download_url");
    }
    // Method 3: Try /stream endpoint with proper auth
    else {
      console.log("Trying /stream endpoint...");
      try {
        const streamResponse = await axios({
          method: "get",
          url: `https://api.soundcloud.com/tracks/${trackId}/stream`,
          headers: {
            Authorization: `OAuth ${token}`,
          },
          maxRedirects: 0,
          validateStatus: (status) =>
            status === 302 || status === 200 || status === 301,
        });

        if (streamResponse.headers.location) {
          streamUrl = streamResponse.headers.location;
          console.log("Got stream URL from /stream endpoint");
        }
      } catch (streamError: any) {
        console.error("Stream endpoint error:", streamError.message);
        if (streamError.response?.headers?.location) {
          streamUrl = streamError.response.headers.location;
          console.log("Got stream URL from error response");
        }
      }
    }

    if (!streamUrl) {
      console.error("No stream URL found for track:", trackId);
      return res.status(404).json({
        error: "No stream URL available for this track",
      });
    }

    console.log("Redirecting to stream URL");
    return res.redirect(307, streamUrl);
  } catch (error: any) {
    console.error(
      "Stream error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired - please log in again",
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to get stream",
    });
  }
}
