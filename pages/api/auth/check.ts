import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Verify token by calling a simple endpoint
    await axios.get("https://api-v2.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    res.json({ authenticated: true });
  } catch (error: any) {
    console.error("Auth check failed:", error.response?.status);

    // Token is invalid or expired
    res.setHeader("Set-Cookie", "soundcloud_token=; Path=/; Max-Age=0");

    return res.status(401).json({ error: "Not authenticated" });
  }
}
