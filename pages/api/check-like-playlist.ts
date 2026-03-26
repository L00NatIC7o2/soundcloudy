import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId } = req.query;
  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!playlistId || typeof playlistId !== "string") {
    return res.status(400).json({ error: "Missing playlistId" });
  }

  try {
    const response = await axios.get(
      "https://api.soundcloud.com/me/likes/playlists",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          ids: playlistId,
          limit: 10,
        },
        timeout: 5000,
      },
    );

    const data = response.data;
    const collection = Array.isArray(data)
      ? data
      : Array.isArray(data?.collection)
        ? data.collection
        : [];

    const playlistIdNum = parseInt(playlistId, 10);
    const isLiked = collection.some((item: any) => {
      const id = item?.playlist?.id ?? item?.id;
      return id === playlistIdNum;
    });

    res.json({ isLiked });
  } catch (error: any) {
    console.error("Check playlist like error:", error.message);
    res.json({ isLiked: false });
  }
}

