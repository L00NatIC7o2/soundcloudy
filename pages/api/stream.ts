import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// SoundCloud web app client_id (publicly available)
const CLIENT_ID = "iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  console.log("Stream request (v2) - trackId:", trackId);

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Use v2 API to get stream URLs
    console.log("Fetching stream from v2 API...");
    const streamResponse = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}/streams`,
      {
        params: {
          client_id: CLIENT_ID,
        },
        timeout: 10000,
      },
    );

    const streams = streamResponse.data;
    console.log("V2 streams received:", Object.keys(streams));

    // Priority order: try to get the best quality progressive stream
    let finalStreamUrl = null;

    // Try progressive streams (HTTP MP3) in quality order
    if (streams.http_mp3_128_url) {
      finalStreamUrl = streams.http_mp3_128_url;
      console.log("Using http_mp3_128_url");
    } else if (streams.progressive) {
      // Some tracks return a single progressive URL
      finalStreamUrl = streams.progressive;
      console.log("Using progressive stream");
    } else if (streams.hls_mp3_128_url) {
      // Fallback to HLS (requires HLS player support)
      finalStreamUrl = streams.hls_mp3_128_url;
      console.log("Using HLS stream (may require HLS player)");
    } else if (streams.hls_opus_64_url) {
      finalStreamUrl = streams.hls_opus_64_url;
      console.log("Using HLS Opus stream (may require HLS player)");
    }

    if (!finalStreamUrl) {
      console.error("No compatible stream found:", streams);
      return res.status(404).json({
        error: "No compatible stream URL available",
        available: Object.keys(streams),
      });
    }

    console.log("Returning v2 stream URL");
    res.json({ streamUrl: finalStreamUrl });
  } catch (error: any) {
    console.error(
      "V2 Stream error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to get stream",
    });
  }
}
