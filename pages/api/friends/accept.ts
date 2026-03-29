import type { NextApiRequest, NextApiResponse } from "next";
import { requireFriendAuth } from "../../../src/server/friends/api";
import {
  acceptFriendRequest,
  readFriendStore,
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

  const requesterUserId = Number(req.body?.requesterUserId || 0);
  if (!requesterUserId) {
    return res.status(400).json({ error: "Missing requester user" });
  }

  const store = await readFriendStore();
  const accepted = acceptFriendRequest(store, auth.userId, requesterUserId);
  if (!accepted) {
    return res.status(404).json({ error: "Friend request not found" });
  }
  await writeFriendStore(store);
  return res.status(200).json({ ok: true, status: "friends" });
}
