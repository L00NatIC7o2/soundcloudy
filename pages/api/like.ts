import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trackId, like } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    const method = like ? "put" : "delete";

    await axios({
      method,
      url: `https://api.soundcloud.com/me/favorites/${trackId}`,
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 5000,
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Like error:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to update like",
    });
  }
}
