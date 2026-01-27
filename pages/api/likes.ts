import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Try V2 API which may include liked_at timestamps
    const likesResp = await axios.get(
      "https://api-v2.soundcloud.com/me/track_likes",
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200 },
      },
    );

    // Extract tracks with liked_at metadata
    const tracks = (likesResp.data.collection || []).map((item: any) => ({
      ...item.track,
      added_at: item.created_at || item.liked_at, // When user liked it
    }));

    res.json({ tracks });
  } catch (error: any) {
    console.error("Likes error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
