import type { NextApiRequest, NextApiResponse } from "next";
import { refreshSoundCloudAuth } from "../../server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    console.log("Refreshing token...");

    const auth = await refreshSoundCloudAuth(req, res, {
      clearOnFailure: false,
    });

    if (!auth) {
      return res.status(401).json({ error: "Failed to refresh token" });
    }

    const refreshToken = req.cookies.soundcloud_refresh_token;
    if (!refreshToken) {
      console.error("Refresh succeeded without a rotated refresh token cookie");
      return res.status(502).json({
        error: "SoundCloud refresh response omitted the rotated refresh token",
      });
    }

    console.log("Token refreshed", {
      expiresIn: 3599,
      refreshTokenPresent: true,
    });
    res.json({
      success: true,
      token: auth.rawToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    });
  } catch (error: any) {
    console.error("Refresh error:", error.response?.data || error.message);
    res.status(401).json({ error: "Failed to refresh token" });
  }
}
