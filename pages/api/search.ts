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

    // Correct v1 API search endpoint
    const url = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(q)}&offset=${offsetNum}&limit=${limitNum}&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}&app_version=1696963967`;

    console.log("🔍 Searching:", q, "offset:", offsetNum);
    console.log(
      "API URL (without client_id):",
      url.replace(/client_id=[^&]*/, "client_id=***"),
    );

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    console.log("Response status:", response.status);
    console.log("Response content-type:", response.headers.get("content-type"));

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

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      const text = await response.text();
      console.error("❌ Response is not JSON:", text.substring(0, 200));
      return res.status(200).json({
        collection: [],
        hasMore: false,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      collection: data || [],
      hasMore: (data?.length || 0) >= limitNum,
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
