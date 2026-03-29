import type { NextApiRequest, NextApiResponse } from "next";
import { refreshSoundCloudAuth } from "../../server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    console.log("Refreshing token...");

    const auth = await refreshSoundCloudAuth(req, res);

    if (!auth) {
      return res.status(401).json({ error: "Failed to refresh token" });
    }

    console.log("Token refreshed - expires in: 3599");
    res.json({ success: true, token: auth.rawToken });
  } catch (error: any) {
    console.error("Refresh error:", error.response?.data || error.message);
    res.status(401).json({ error: "Failed to refresh token" });
  }
}

