import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  console.log("Likes API - token exists:", !!token);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get(
      "https://api.soundcloud.com/me/favorites",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 200,
          linked_partitioning: 1,
        },
        timeout: 10000,
      },
    );

    console.log("Likes count:", response.data.collection?.length || 0);

    const tracks = response.data.collection || [];

    res.json({ tracks });
  } catch (error: any) {
    console.error(
      "Likes error:",
      error.response?.status,
      error.response?.data,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
        tracks: [],
      });
    }

    res.status(error.response?.status || 500).json({
      error: "Failed to fetch likes",
      tracks: [],
    });
  }
}
