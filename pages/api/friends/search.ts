import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildFriendCode,
  fetchCurrentSoundCloudUser,
  fetchSoundCloudUserById,
  parseFriendCode,
  requireFriendAuth,
  searchSoundCloudUsers,
} from "../../../src/server/friends/api";
import {
  getFriendStatus,
  readFriendStore,
  type StoredFriendUser,
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

  const query = String(req.query.q || "").trim();
  if (!query) {
    return res.status(200).json({ results: [] });
  }

  try {
    const store = await readFriendStore();
    const me = await fetchCurrentSoundCloudUser(auth.token);
    upsertStoredUser(store, me);

    const codeUserId = parseFriendCode(query);
    const users = codeUserId
      ? [await fetchSoundCloudUserById(auth.token, codeUserId)]
      : await searchSoundCloudUsers(auth.token, query);

    users.forEach((user: StoredFriendUser) => upsertStoredUser(store, user));
    await writeFriendStore(store);

    const results = users
      .filter((user: StoredFriendUser) => Number(user.userId) > 0)
      .map((user: StoredFriendUser) => ({
        userId: user.userId,
        name: user.username,
        avatarUrl: user.avatarUrl || null,
        permalink: user.permalink || null,
        friendCode: buildFriendCode(user.userId),
        status: getFriendStatus(store, auth.userId, user.userId),
      }))
      .slice(0, 8);

    return res.status(200).json({ results });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to search for friends" });
  }
}
