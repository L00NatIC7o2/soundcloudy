import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { userId } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    await axios.put(
      `https://api.soundcloud.com/me/followings/${userId}`,
      {},
      { headers: { Authorization: `OAuth ${token}` }, timeout: 8000 },
    );

    return res.json({ success: true });
  } catch (error: any) {
    return res
      .status(error.response?.status || 500)
      .json({ error: error.response?.data?.message || "Failed to follow" });
  }
}
