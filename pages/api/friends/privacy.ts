import type { NextApiRequest, NextApiResponse } from "next";
import { requireFriendAuth } from "../../../src/server/friends/api";
import {
  getPrivacyForUser,
  readFriendStore,
  setPrivacyForUser,
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

  const store = await readFriendStore();
  setPrivacyForUser(store, auth.userId, {
    appearOffline: Boolean(req.body?.appearOffline),
    shareListeningActivity: req.body?.shareListeningActivity !== false,
  });
  await writeFriendStore(store);
  return res.status(200).json({ ok: true, privacy: getPrivacyForUser(store, auth.userId) });
}
