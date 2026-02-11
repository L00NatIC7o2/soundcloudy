import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", [
    "soundcloud_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    "soundcloud_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ]);

  return res.status(200).json({ ok: true });
}
