import type { NextApiRequest, NextApiResponse } from "next";
import {
  fetchCurrentSoundCloudUser,
  fetchSoundCloudUserById,
  requireFriendAuth,
} from "../../../src/server/friends/api";
import {
  readFriendStore,
  sendFriendRequest,
  upsertStoredUser,
  writeFriendStore,
} from "../../../src/server/friends/store";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireFriendAuth(req, res);
  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const targetUserId = Number(req.body?.targetUserId || 0);
  if (!targetUserId || targetUserId === auth.userId) {
    return res.status(400).json({ error: "Invalid target user" });
  }

  try {
    const [me, target] = await Promise.all([
      fetchCurrentSoundCloudUser(auth.token),
      fetchSoundCloudUserById(auth.token, targetUserId),
    ]);
    const store = await readFriendStore();
    upsertStoredUser(store, me);
    upsertStoredUser(store, target);
    const status = sendFriendRequest(store, auth.userId, targetUserId);
    await writeFriendStore(store);
    return res.status(200).json({ ok: true, status });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || "Failed to send friend request" });
  }
}
