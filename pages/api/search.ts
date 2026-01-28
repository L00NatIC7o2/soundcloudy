import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { q, offset = "0", limit = "20" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        collection: [],
        hasMore: false,
      });
    }

    const offsetNum = parseInt(offset as string) || 0;
    const limitNum = parseInt(limit as string) || 20;

    // Get the access token from cookies
    const token = req.cookies.access_token;

    if (!token) {
      console.error("❌ No access token found");
      return res.status(401).json({
        error: "Not authenticated",
        collection: [],
        hasMore: false,
      });
    }

    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&offset=${offsetNum}&limit=${limitNum}`;

    console.log("🔍 Searching:", q, "offset:", offsetNum);

    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${token}`,
        Accept: "application/json",
      },
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "❌ SoundCloud API error:",
        response.status,
        text.substring(0, 200),
      );
      return res.status(200).json({
        collection: [],
        hasMore: false,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      collection: data.collection || [],
      hasMore: data.next_href ? true : false,
    });
  } catch (error) {
    console.error(
      "❌ Search error:",
      error instanceof Error ? error.message : error,
    );
    return res.status(200).json({
      collection: [],
      hasMore: false,
    });
  }
}
