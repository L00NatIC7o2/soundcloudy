import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trackId, like } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    const trackUrn = `soundcloud:tracks:${trackId}`;

    if (like) {
      // Like the track
      await axios.post(
        `https://api.soundcloud.com/likes/tracks/${trackUrn}`,
        {},
        { headers: { Authorization: `OAuth ${token}` } },
      );
    } else {
      // Unlike the track
      await axios.delete(
        `https://api.soundcloud.com/likes/tracks/${trackUrn}`,
        { headers: { Authorization: `OAuth ${token}` } },
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Like error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
