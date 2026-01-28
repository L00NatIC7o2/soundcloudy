import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { title, artist } = req.query as { title?: string; artist?: string };
  const geniusToken = process.env.GENIUS_API_TOKEN;

  if (!geniusToken) {
    console.warn("GENIUS_API_TOKEN not configured");
    return res
      .status(200)
      .json({ found: false, reason: "Token not configured" });
  }

  if (!title || title.trim() === "") {
    return res.status(200).json({ found: false, reason: "Missing title" });
  }

  try {
    const searchQuery =
      artist && artist.trim() !== "" ? `${title} ${artist}` : title;

    const searchResp = await axios.get("https://api.genius.com/search", {
      headers: { Authorization: `Bearer ${geniusToken}` },
      params: { q: searchQuery },
      timeout: 5000,
    });

    const hits = searchResp.data?.response?.hits || [];

    if (hits.length === 0) {
      return res.json({ found: false });
    }

    const song = hits[0].result;
    const releaseDate = song.release_date_for_display || song.release_date;

    res.json({
      found: true,
      releaseDate: releaseDate || null,
      title: song.title,
      artist: song.primary_artist?.name,
      url: song.url,
    });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Genius API error:",
        error.response?.status,
        error.response?.data || error.message,
      );
    } else {
      console.error("Genius API error:", error.message);
    }
    res.status(200).json({ found: false, reason: error.message });
  }
}
