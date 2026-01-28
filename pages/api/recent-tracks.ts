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
    // Get user's own profile first
    const userResp = await axios.get("https://api-v2.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    const userId = userResp.data.id;

    // Get user's recent tracks
    const tracksResp = await axios.get(
      `https://api-v2.soundcloud.com/users/${userId}/track_reposts`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          limit: 1,
          linked_partitioning: true,
        },
      },
    );

    const collection = tracksResp.data.collection || [];

    if (collection.length > 0) {
      // The repost object contains a 'track' property
      const track = collection[0].track || collection[0];
      return res.json({ track });
    }

    // Fallback: get user's likes if no reposts
    const likesResp = await axios.get(
      `https://api-v2.soundcloud.com/users/${userId}/likes`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          limit: 1,
          linked_partitioning: true,
        },
      },
    );

    const likes = likesResp.data.collection || [];
    if (likes.length > 0) {
      const track = likes[0].track || likes[0];
      return res.json({ track });
    }

    // If no likes, get user's own tracks
    const ownTracksResp = await axios.get(
      `https://api-v2.soundcloud.com/users/${userId}/tracks`,
      {
        headers: { Authorization: `OAuth ${token}` },
        params: {
          limit: 1,
          linked_partitioning: true,
        },
      },
    );

    const ownTracks = ownTracksResp.data.collection || [];
    if (ownTracks.length > 0) {
      return res.json({ track: ownTracks[0] });
    }

    return res.json({ track: null });
  } catch (error: any) {
    console.error(
      "Recent tracks error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
      track: null,
    });
  }
}
