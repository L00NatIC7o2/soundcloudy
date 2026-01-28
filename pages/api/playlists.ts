import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  console.log("Playlists API - token exists:", !!token);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get(
      "https://api.soundcloud.com/me/playlists",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 50,
          linked_partitioning: 1,
        },
        timeout: 10000,
      },
    );

    console.log("SoundCloud API response:", response.status);
    console.log(
      "Playlists count:",
      response.data.collection?.length || response.data.length || 0,
    );

    const playlists = response.data.collection || response.data || [];
    res.json({ playlists });
  } catch (error: any) {
    console.error(
      "Playlists error:",
      error.response?.status,
      error.response?.data,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
        playlists: [],
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to fetch playlists",
      playlists: [],
    });
  }
}
