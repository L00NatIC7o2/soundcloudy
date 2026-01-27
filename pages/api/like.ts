import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, like } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    if (like) {
      // Add to likes/favorites
      await axios.put(
        `https://api.soundcloud.com/me/favorites/${trackId}`,
        {},
        { headers: { Authorization: `OAuth ${token}` } },
      );
    } else {
      // Remove from likes/favorites
      await axios.delete(`https://api.soundcloud.com/me/favorites/${trackId}`, {
        headers: { Authorization: `OAuth ${token}` },
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Like error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
