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

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // Check if track is in user's likes
    const response = await axios.get(
      `https://api-v2.soundcloud.com/me/likes/${trackId}`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: { client_id: process.env.SOUNDCLOUD_CLIENT_ID },
        timeout: 5000,
      },
    );

    res.json({ isLiked: !!response.data });
  } catch (error: any) {
    // 404 means not liked
    if (error.response?.status === 404) {
      return res.json({ isLiked: false });
    }

    console.error("Check like error:", error.message);
    res.json({ isLiked: false }); // Default to not liked on error
  }
}
