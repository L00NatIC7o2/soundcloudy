import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // Get token from cookies (set during OAuth login)
    const token =
      req.cookies.access_token || process.env.SOUNDCLOUD_OAUTH_TOKEN;

    if (!token) {
      console.error("❌ No OAuth token found");
      return res.status(401).json({ error: "Not authenticated", likes: [] });
    }

    console.log("Fetching likes with token...");

    const response = await axios.get("https://api-v2.soundcloud.com/me/likes", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      params: {
        limit: 50,
      },
      timeout: 10000,
    });

    res.json({ likes: response.data.collection || [] });
  } catch (error: any) {
    console.error("Likes error:", error.message);
    res.status(200).json({ likes: [] });
  }
}
