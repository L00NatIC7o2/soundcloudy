import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get("https://api.soundcloud.com/me", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 10000,
    });

    const user = response.data;

    // Optionally fetch user's tracks
    let tracks = [];
    try {
      const tracksResponse = await axios.get(
        "https://api.soundcloud.com/users/" + user.id + "/tracks",
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
      console.error("Failed to fetch user tracks:", error);
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
      "Profile fetch error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch profile" });
  }
}
