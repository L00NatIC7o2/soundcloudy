import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { q } = req.query as { q?: string };
  const token = req.cookies.soundcloud_token;

  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: { q, limit: 50 },
      headers: { Authorization: `OAuth ${token}` },
    });
    res.json({ collection: response.data });
  } catch (error: any) {
    console.error("Search error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
