import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { offset = "0", limit = "50" } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated", likes: [] });
  }

  try {
    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 50;

    const response = await axios.get(
      "https://api.soundcloud.com/me/favorites",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          offset: offsetNum,
          limit: limitNum,
        },
        timeout: 10000,
      },
    );

    const likes = Array.isArray(response.data)
      ? response.data
      : response.data?.collection || [];
    const hasMore = Array.isArray(response.data)
      ? likes.length >= limitNum
      : Boolean(response.data?.next_href);

    res.json({ likes, hasMore });
  } catch (error: any) {
    console.error(
      "Likes error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated", likes: [] });
    }

    res.status(error.response?.status || 500).json({ likes: [] });
  }
}
