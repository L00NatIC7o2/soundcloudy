import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    console.log("Fetching likes...");

    const response = await axios.get("https://api.soundcloud.com/me/likes", {
      params: {
        limit: 50,
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
      },
      timeout: 10000,
    });

    res.json({ likes: response.data || [] });
  } catch (error: any) {
    console.error("Likes error:", error.message);
    res.status(200).json({ likes: [] });
  }
}
