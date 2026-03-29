import type { NextApiRequest, NextApiResponse } from "next";
import { requireFriendAuth } from "../../../src/server/friends/api";
import {
  readFriendStore,
  removeFriendRelation,
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
  if (!targetUserId) {
    return res.status(400).json({ error: "Missing target user" });
  }

  const store = await readFriendStore();
  removeFriendRelation(store, auth.userId, targetUserId);
  await writeFriendStore(store);
  return res.status(200).json({ ok: true, status: "none" });
}
