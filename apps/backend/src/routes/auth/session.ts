import type { NextApiRequest, NextApiResponse } from "next";
import {
  establishSoundCloudSession,
  getStoredSoundCloudSession,
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
} from "../../server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!sessionState) {
    let auth = await getRequestSoundCloudAuthContext(req, res);

    if (!auth) {
      auth = await refreshSoundCloudAuth(req, res);
    }

    if (!auth) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      await establishSoundCloudSession(
        req,
        res,
        auth.rawToken,
        req.cookies.soundcloud_refresh_token || undefined,
      );
    } catch {
      // If session bootstrap fails here, fall through and let the normal
      // session lookup below decide whether the request is authenticated.
    }

    sessionState = await getStoredSoundCloudSession(req, res);
  }

  const userId = Number(sessionState?.session?.userId || sessionState?.tokens?.userId);

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.status(200).json({
    authenticated: true,
    userId,
    roomId: `soundcloud-user-${userId}`,
    username: sessionState?.tokens?.username || null,
  });
}

