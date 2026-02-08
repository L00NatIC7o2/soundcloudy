import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const token = req.cookies.soundcloud_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "Missing ids" });
    return;
  }

  const normalized = ids
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (normalized.length === 0) {
    res.status(400).json({ error: "Missing valid ids" });
    return;
  }

  const maxIds = normalized.slice(0, 200);
  try {
    const response = await axios.get("https://api.soundcloud.com/tracks", {
      params: { ids: maxIds.join(",") },
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 10000,
    });

    const tracks = Array.isArray(response.data) ? response.data : [];
    res.status(200).json({ tracks });
  } catch (error: any) {
    res.status(error?.response?.status || 500).json({
      error: error?.response?.data || error?.message || "Unknown error",
    });
  }
}
