import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { title, artist } = req.query as { title?: string; artist?: string };
  const geniusToken = process.env.GENIUS_API_TOKEN;

  if (!geniusToken) {
    return res.status(500).json({ error: "Genius API token not configured" });
  }

  if (!title) {
    return res.status(400).json({ error: "Missing title" });
  }

  try {
    const searchQuery = artist ? `${title} ${artist}` : title;

    const searchResp = await axios.get("https://api.genius.com/search", {
      headers: { Authorization: `Bearer ${geniusToken}` },
      params: { q: searchQuery },
    });

    const hits = searchResp.data.response.hits;
    if (hits.length === 0) {
      return res.json({ found: false });
    }

    // Get first match
    const song = hits[0].result;
    const releaseDate = song.release_date_for_display || song.release_date;

    res.json({
      found: true,
      releaseDate,
      title: song.title,
      artist: song.primary_artist.name,
      url: song.url,
    });
  } catch (error: any) {
    console.error("Genius API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch from Genius" });
  }
}
