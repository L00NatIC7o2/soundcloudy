import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    // Verify token is valid by making a test request
    await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });

    res.status(200).json({ authenticated: true });
  } catch (error: any) {
    console.error("Token validation failed:", error.message);
    res.status(401).json({ authenticated: false });
  }
}
