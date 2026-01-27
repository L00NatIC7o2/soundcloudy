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
    // Get user's recent activities/plays
    const meResp = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = meResp.data.id;

    // Try to get recent activities
    const activitiesResp = await axios.get(
      `https://api.soundcloud.com/users/${userId}/activities`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 1 },
      },
    );

    const recentTrack = activitiesResp.data.collection?.[0]?.origin;

    res.json({ track: recentTrack || null });
  } catch (error: any) {
    console.error(
      "Recent tracks error:",
      error.response?.data || error.message,
    );
    res.status(500).json({ error: "Failed to fetch recent tracks" });
  }
}
