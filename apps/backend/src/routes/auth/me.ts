import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getSessionRefreshFailureInfo,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
} from "../../server/auth/soundcloud";

const fetchCurrentUser = async (authorization: string) => {
  const response = await axios.get("https://api.soundcloud.com/me", {
    headers: { Authorization: authorization },
    timeout: 10000,
  });

  return response.data;
};

const getTransientStoredUser = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const sessionState = await getStoredSoundCloudSession(req, res);
  const sessionId = sessionState?.session?.sessionId;
  const failureInfo = getSessionRefreshFailureInfo(sessionId);

  if (
    !sessionState?.session ||
    !sessionState.tokens ||
    !failureInfo ||
    Date.now() - (failureInfo.lastFailedAt || 0) >= 30000
  ) {
    return null;
  }

  const numericId = Number(sessionState.session.userId);
  return {
    id: Number.isFinite(numericId) ? numericId : sessionState.session.userId,
    username: sessionState.tokens.username || "SoundCloud User",
    transient: true,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    let auth = await getRequestSoundCloudAuthContext(req, res);

    if (!auth) {
      auth = await refreshSoundCloudAuth(req, res);
    }

    if (!auth) {
      const transientUser = await getTransientStoredUser(req, res);
      if (transientUser) {
        return res.status(200).json(transientUser);
      }

      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await fetchCurrentUser(auth.headerValue);
      return res.status(200).json(user);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }
    }

    auth = await refreshSoundCloudAuth(req, res, { force: true });

    if (!auth) {
      const transientUser = await getTransientStoredUser(req, res);
      if (transientUser) {
        return res.status(200).json(transientUser);
      }

      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await fetchCurrentUser(auth.headerValue);
      return res.status(200).json(user);
    } catch (error: any) {
      if (error.response?.status === 401) {
        const transientUser = await getTransientStoredUser(req, res);
        if (transientUser) {
          return res.status(200).json(transientUser);
        }
      }

      throw error;
    }
  } catch (error: any) {
    console.error("Error in /me:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    return res.status(500).json({ error: "Failed to load current user" });
  }
}
