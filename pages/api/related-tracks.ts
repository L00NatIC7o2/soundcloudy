import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // Get related tracks - this endpoint is public
    const response = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}/related`,
      {
        params: {
          limit: 20,
          client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        },
        timeout: 5000,
      },
    );

    res.json({ collection: response.data.collection || [] });
  } catch (error: any) {
    console.error("Related tracks error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch related tracks",
      collection: [],
    });
  }
}
