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
    const response = await axios.get(
      "https://api.soundcloud.com/me/favorites",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 1,
        },
        timeout: 5000,
      },
    );

    // Check if track is in favorites
    const isLiked = response.data.collection?.some(
      (item: any) => (item.track?.id || item.id) === parseInt(trackId),
    );

    res.json({ isLiked: !!isLiked });
  } catch (error: any) {
    console.error("Check like error:", error.message);
    res.json({ isLiked: false });
  }
}
