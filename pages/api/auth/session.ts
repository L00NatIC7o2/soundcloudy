import type { NextApiRequest, NextApiResponse } from "next";
import {
  getStoredSoundCloudSession,
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
} from "../../../src/server/auth/soundcloud";

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
