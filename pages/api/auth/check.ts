import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
} from "../../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    let auth = await getRequestSoundCloudAuthContext(req, res);

    console.log(
      "Auth check - token exists:",
      !!req.cookies.soundcloud_token,
      "refresh exists:",
      !!req.cookies.soundcloud_refresh_token,
    );

    if (!auth) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      await axios.get("https://api.soundcloud.com/me", {
        headers: { Authorization: auth.headerValue },
        timeout: 5000,
      });

      console.log("Auth check passed - token still valid");
      res.json({ authenticated: true });
      return;
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }
    }

    console.log("Token expired, attempting refresh...");
    auth = await refreshSoundCloudAuth(req, res);

    if (!auth) {
      return res.status(401).json({ error: "Token expired - please log in again" });
    }

    await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: auth.headerValue },
      timeout: 5000,
    });

    console.log("Token refreshed successfully - expires in: 3599");
    res.json({ authenticated: true });
  } catch (error: any) {
    console.error("Auth check error:", error.response?.data || error.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}
