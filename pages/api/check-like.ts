import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Get user's likes and check if trackId is in there
    const meResp = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = meResp.data.id;

    const likesResp = await axios.get(
      `https://api.soundcloud.com/users/${userId}/favorites`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { limit: 200 },
      },
    );

    const isLiked = likesResp.data.some(
      (track: any) => track.id === parseInt(trackId as string),
    );

    res.json({ isLiked });
  } catch (error: any) {
    console.error("Check like error:", error.response?.data || error.message);
    res.json({ isLiked: false });
  }
}
