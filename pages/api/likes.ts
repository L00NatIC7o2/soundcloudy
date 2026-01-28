import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const response = await fetch(
      `https://api-v2.soundcloud.com/me/likes?limit=50&client_id=${process.env.SOUNDCLOUD_CLIENT_ID}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
      },
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch likes",
      });
    }

    const data = await response.json();

    return res.status(200).json({
      likes: data.collection || [],
    });
  } catch (error) {
    console.error("Likes error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
