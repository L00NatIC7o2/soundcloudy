import type { NextApiRequest, NextApiResponse } from "next";
import {
  buildFriendCode,
  fetchCurrentSoundCloudUser,
  requireFriendAuth,
} from "../../../src/server/friends/api";
import {
  getFriendPresence,
  getFriendStatus,
  getPrivacyForUser,
  listFriendIds,
  listIncomingFriendRequests,
  listOutgoingFriendRequests,
  readFriendStore,
  upsertStoredUser,
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

  const store = await readFriendStore();
  const me = await fetchCurrentSoundCloudUser(auth.token);
  upsertStoredUser(store, me);

  const friendIds = listFriendIds(store, auth.userId);
  const friends = friendIds.map((friendId) => {
    const user = store.users[String(friendId)];
    const privacy = getPrivacyForUser(store, friendId);
    const presence = getFriendPresence(friendId);
    const canShare = privacy.shareListeningActivity && !privacy.appearOffline;
    const activeTrack =
      canShare && presence.online && presence.isPlaying
        ? presence.currentTrack
        : null;
    const lastTrack = privacy.appearOffline
      ? presence.lastTrack
      : presence.online
        ? null
        : presence.lastTrack;

    return {
      id: String(friendId),
      userId: friendId,
      name: user?.username || `User ${friendId}`,
      avatarUrl: user?.avatarUrl || null,
      permalink: user?.permalink || null,
      visibility: "online",
      online: privacy.appearOffline ? false : Boolean(presence.online),
      updatedAt: presence.updatedAt || null,
      currentTrack: activeTrack,
      lastTrack,
    };
  });

  const incomingRequests = listIncomingFriendRequests(store, auth.userId).map(
    (request) => {
      const user = store.users[String(request.fromUserId)];
      return {
        userId: request.fromUserId,
        name: user?.username || `User ${request.fromUserId}`,
        avatarUrl: user?.avatarUrl || null,
        permalink: user?.permalink || null,
        createdAt: request.createdAt,
      };
    },
  );

  const outgoingRequests = listOutgoingFriendRequests(store, auth.userId).map(
    (request) => {
      const user = store.users[String(request.toUserId)];
      return {
        userId: request.toUserId,
        name: user?.username || `User ${request.toUserId}`,
        avatarUrl: user?.avatarUrl || null,
        permalink: user?.permalink || null,
        createdAt: request.createdAt,
        status: getFriendStatus(store, auth.userId, request.toUserId),
      };
    },
  );

  return res.status(200).json({
    self: {
      userId: me.userId,
      name: me.username,
      avatarUrl: me.avatarUrl || null,
      permalink: me.permalink || null,
    },
    friendCode: buildFriendCode(auth.userId),
    friends,
    incomingRequests,
    outgoingRequests,
    privacy: getPrivacyForUser(store, auth.userId),
  });
}
