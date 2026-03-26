import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = await requireSoundCloudAccessToken(req, res);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { urls, limit } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "Missing urls" });
    return;
  }

  const maxItems =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.min(Number(limit), 200)
      : 100;

  const tracks: any[] = [];
  const seen = new Set<number>();
  for (const url of urls) {
    if (tracks.length >= maxItems) break;
    try {
      const response = await axios.get("https://api.soundcloud.com/resolve", {
        params: { url },
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 8000,
      });
      const data = response.data;
      if (data?.kind === "track" && data.id && !seen.has(data.id)) {
        seen.add(data.id);
        tracks.push(data);
      }
    } catch (_error) {
      // Ignore resolve failures for individual URLs.
    }
  }

  res.status(200).json({ tracks });
}

