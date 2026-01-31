import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}/related`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 10,
        },
        timeout: 10000,
      },
    );

    res.json({ tracks: response.data || [] });
  } catch (error: any) {
    console.error(
      "Related tracks error:",
      error.response?.status,
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({ tracks: [] });
  }
}
