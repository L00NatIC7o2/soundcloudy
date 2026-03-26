import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { userId } = req.query;
  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    await axios.get(`https://api.soundcloud.com/me/followings/${userId}`, {
      headers: { Authorization: `OAuth ${token}` },
      timeout: 8000,
    });

    return res.json({ isFollowing: true });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.json({ isFollowing: false });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    return res
      .status(error.response?.status || 500)
      .json({ error: "Failed to check follow status" });
  }
}

