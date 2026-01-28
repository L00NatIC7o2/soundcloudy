import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const token = req.cookies.soundcloud_token;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Token exists - we trust it since we set it ourselves
    // SoundCloud tokens don't expire when using "non-expiring" scope
    res.json({ authenticated: true });
  } catch (error: any) {
    res.setHeader("Set-Cookie", "soundcloud_token=; Path=/; Max-Age=0");
    return res.status(401).json({ error: "Token invalid" });
  }
}
