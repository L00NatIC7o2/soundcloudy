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

  try {
    // First get track info to see if it has a stream
    const trackResponse = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}`,
      {
        headers: token ? { Authorization: `OAuth ${token}` } : {},
        params: {
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    const track = trackResponse.data;

    // Try to get stream URL
    let streamUrl = null;

    // Method 1: Check if track has direct stream_url
    if (track.stream_url) {
      streamUrl = `${track.stream_url}?client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`;
    }
    // Method 2: Check for download_url (some tracks)
    else if (track.download_url && track.downloadable) {
      streamUrl = `${track.download_url}?client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`;
    }
    // Method 3: Try the /stream endpoint
    else {
      try {
        const streamResponse = await axios.get(
          `https://api.soundcloud.com/tracks/${trackId}/stream`,
          {
            headers: token ? { Authorization: `OAuth ${token}` } : {},
            params: {
              client_id: process.env.SOUNDCLOUD_CLIENT_ID,
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
      return res
        .status(404)
        .json({ error: "No stream available for this track" });
    }

    console.log("Streaming track:", trackId);
    return res.redirect(307, streamUrl);
  } catch (error: any) {
    console.error("Stream error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to get stream",
    });
  }
}
