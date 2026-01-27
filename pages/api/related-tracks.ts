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

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    // SoundCloud's related tracks endpoint
    const response = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${trackId}/related`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          limit: 20,
        },
      },
    );

    res.json({ collection: response.data.collection || [] });
  } catch (error: any) {
    console.error(
      "Related tracks error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
      collection: [],
    });
  }
}
