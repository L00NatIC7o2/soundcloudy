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
    // Get current user info first
    const meResp = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = meResp.data.id;

    // Get user's likes/favorites
    const likesResp = await axios.get(
      `https://api.soundcloud.com/users/${userId}/favorites`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200 },
      },
    );

    res.json({ tracks: likesResp.data });
  } catch (error: any) {
    console.error("Likes error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
