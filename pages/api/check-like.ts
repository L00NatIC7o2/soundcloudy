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

  if (!trackId || typeof trackId !== "string") {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    const response = await axios.get(
      "https://api.soundcloud.com/me/likes/tracks",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          ids: trackId,
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

    const trackIdNum = parseInt(trackId, 10);
    const isLiked = collection.some((item: any) => {
      const id = item?.track?.id ?? item?.id;
      return id === trackIdNum;
    });

    res.json({ isLiked });
  } catch (error: any) {
    console.error("Check like error:", error.message);
    res.json({ isLiked: false });
  }
}
