import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated", playlists: [] });
  }

  try {
    const response = await axios.get(
      "https://api.soundcloud.com/me/likes/playlists",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 200,
        },
        timeout: 10000,
      },
    );

    const data = response.data;
    const rawPlaylists = Array.isArray(data)
      ? data
      : Array.isArray(data?.collection)
        ? data.collection
        : [];

    res.json({ playlists: rawPlaylists });
  } catch (error: any) {
    console.error("Likes playlists error:", error.message);
    res.status(error.response?.status || 500).json({ playlists: [] });
  }
}
