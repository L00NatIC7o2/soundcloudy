import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  getStoredSoundCloudSession,
  getSessionRefreshFailureInfo,
} from "../../server/auth/soundcloud";

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

    console.log("Token expired or invalid, attempting refresh...");
    const sessionState = await getStoredSoundCloudSession(req, res);
    const hasRefreshToken = Boolean(
      req.cookies.soundcloud_refresh_token ||
      sessionState?.tokens?.refreshToken,
    );
    console.log("Auth check - hasRefreshToken:", hasRefreshToken);

    // During an auth *check* we should not clear sessions on transient
    // refresh failures. Clearing is destructive and can cause logout loops.
    // Use clearOnFailure:false so only explicit refresh/logout flows remove
    // session state.
    auth = await refreshSoundCloudAuth(req, res, {
      force: true,
      clearOnFailure: false,
    });

    if (!auth) {
      // If we have an app session and recent transient failures (cooldown),
      // treat the session as temporarily authenticated to avoid client-side
      // redirect loops. The UI can handle showing a transient auth error.
      const sessionState = await getStoredSoundCloudSession(req, res);
      const sessionId = sessionState?.session?.sessionId;
      const failureInfo = getSessionRefreshFailureInfo(sessionId);
      const now = Date.now();
      if (
        sessionId &&
        failureInfo &&
        now - (failureInfo.lastFailedAt || 0) < 30000
      ) {
        console.log(
          "Auth check - transient failures for session, responding OK to avoid redirect",
          { sessionId, failureInfo },
        );
        return res.json({ authenticated: true, transient: true });
      }

      return res
        .status(401)
        .json({ error: "Token expired - please log in again" });
    }

    await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: auth.headerValue },
      timeout: 5000,
    });

    console.log("Token refreshed successfully - expires in: 3599");
    res.json({ authenticated: true });
  } catch (error: any) {
    if (error.response?.status === 401) {
      return res
        .status(401)
        .json({ error: "Token expired - please log in again" });
    }
    console.error("Auth check error:", error.response?.data || error.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}
