import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing artist ID" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Fetch user info
    const userResponse = await axios.get(
      `https://api.soundcloud.com/users/${id}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      },
    );

    const user = userResponse.data;

    // Fetch user's tracks
    let tracks = [];
    try {
      const tracksResponse = await axios.get(
        `https://api.soundcloud.com/users/${id}/tracks`,
        {
          headers: {
            Authorization: `OAuth ${token}`,
          },
          params: {
            limit: 200,
            access: "playable",
          },
          timeout: 10000,
        },
      );
      tracks = Array.isArray(tracksResponse.data)
        ? tracksResponse.data
        : tracksResponse.data?.collection || [];
    } catch (error) {
      console.error("Failed to fetch artist tracks:", error);
    }

    return res.json({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      banner_url: user.header_image_url || user.banner_url,
      description: user.description,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      track_count: user.track_count,
      tracks,
    });
  } catch (error: any) {
    console.error(
      "Artist fetch error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch artist profile" });
  }
}
