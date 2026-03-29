import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchSoundCloudUserById,
  requireFriendAuth,
} from "../../../src/server/friends/api";
import {
  getFriendStatus,
  readFriendStore,
  upsertStoredUser,
  writeFriendStore,
} from "../../../src/server/friends/store";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireFriendAuth(req, res);
  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const targetUserId = Number(req.query.userId || 0);
  if (!targetUserId) {
    return res.status(400).json({ error: "Missing target user" });
  }

  const store = await readFriendStore();
  if (!store.users[String(targetUserId)]) {
    try {
      const target = await fetchSoundCloudUserById(auth.token, targetUserId);
      upsertStoredUser(store, target);
      await writeFriendStore(store);
    } catch {
      // ignore metadata fetch failures
    }
  }

  return res.status(200).json({
    status: getFriendStatus(store, auth.userId, targetUserId),
  });
}
