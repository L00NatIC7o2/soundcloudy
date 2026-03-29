import { promises as fs } from "fs";
import path from "path";

export type StoredFriendUser = {
  userId: number;
  username: string;
  avatarUrl: string | null;
  permalink: string | null;
};

export type StoredFriendRequest = {
  fromUserId: number;
  toUserId: number;
  createdAt: number;
};

export type StoredFriendship = {
  userA: number;
  userB: number;
  createdAt: number;
};

export type StoredPrivacySettings = {
  appearOffline: boolean;
  shareListeningActivity: boolean;
};

type FriendStoreShape = {
  users: Record<string, StoredFriendUser>;
  friendRequests: StoredFriendRequest[];
  friendships: StoredFriendship[];
  privacy: Record<string, StoredPrivacySettings>;
};

export type FriendPresenceTrack = {
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
};

export type FriendPresenceState = {
  online: boolean;
  isPlaying: boolean;
  currentTrack: FriendPresenceTrack | null;
  lastTrack: FriendPresenceTrack | null;
  updatedAt: number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "friends.json");

const defaultStore = (): FriendStoreShape => ({
  users: {},
  friendRequests: [],
  friendships: [],
  privacy: {},
});

const PRESENCE_STALE_MS = 90_000;
const presenceByUserId = new Map<number, FriendPresenceState>();

let writeQueue = Promise.resolve();

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(defaultStore(), null, 2), "utf8");
  }
}

export async function readFriendStore(): Promise<FriendStoreShape> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return {
      users: parsed?.users || {},
      friendRequests: Array.isArray(parsed?.friendRequests) ? parsed.friendRequests : [],
      friendships: Array.isArray(parsed?.friendships) ? parsed.friendships : [],
      privacy: parsed?.privacy || {},
    };
  } catch {
    return defaultStore();
  }
}

export async function writeFriendStore(nextStore: FriendStoreShape) {
  await ensureStoreFile();
  writeQueue = writeQueue.then(() =>
    fs.writeFile(STORE_PATH, JSON.stringify(nextStore, null, 2), "utf8"),
  );
  await writeQueue;
}

export function getDefaultPrivacy(): StoredPrivacySettings {
  return {
    appearOffline: false,
    shareListeningActivity: true,
  };
}

export function getPrivacyForUser(store: FriendStoreShape, userId: number) {
  return store.privacy[String(userId)] || getDefaultPrivacy();
}

export function upsertStoredUser(
  store: FriendStoreShape,
  user: StoredFriendUser,
) {
  store.users[String(user.userId)] = {
    userId: user.userId,
    username: user.username,
    avatarUrl: user.avatarUrl || null,
    permalink: user.permalink || null,
  };
}

export function setPrivacyForUser(
  store: FriendStoreShape,
  userId: number,
  partial: Partial<StoredPrivacySettings>,
) {
  store.privacy[String(userId)] = {
    ...getPrivacyForUser(store, userId),
    ...partial,
  };
}

export function areFriends(store: FriendStoreShape, userA: number, userB: number) {
  return store.friendships.some(
    (friendship) =>
      (friendship.userA === userA && friendship.userB === userB) ||
      (friendship.userA === userB && friendship.userB === userA),
  );
}

export function getFriendStatus(
  store: FriendStoreShape,
  currentUserId: number,
  targetUserId: number,
) {
  if (currentUserId === targetUserId) return "self";
  if (areFriends(store, currentUserId, targetUserId)) return "friends";
  if (
    store.friendRequests.some(
      (request) =>
        request.fromUserId === currentUserId && request.toUserId === targetUserId,
    )
  ) {
    return "outgoing";
  }
  if (
    store.friendRequests.some(
      (request) =>
        request.fromUserId === targetUserId && request.toUserId === currentUserId,
    )
  ) {
    return "incoming";
  }
  return "none";
}

export function sendFriendRequest(
  store: FriendStoreShape,
  fromUserId: number,
  toUserId: number,
) {
  const status = getFriendStatus(store, fromUserId, toUserId);
  if (status !== "none") return status;
  store.friendRequests.push({
    fromUserId,
    toUserId,
    createdAt: Date.now(),
  });
  return "outgoing";
}

export function acceptFriendRequest(
  store: FriendStoreShape,
  currentUserId: number,
  requesterUserId: number,
) {
  const requestIndex = store.friendRequests.findIndex(
    (request) =>
      request.fromUserId === requesterUserId &&
      request.toUserId === currentUserId,
  );
  if (requestIndex === -1) return false;

  store.friendRequests.splice(requestIndex, 1);
  if (!areFriends(store, currentUserId, requesterUserId)) {
    store.friendships.push({
      userA: Math.min(currentUserId, requesterUserId),
      userB: Math.max(currentUserId, requesterUserId),
      createdAt: Date.now(),
    });
  }
  return true;
}

export function removeFriendRelation(
  store: FriendStoreShape,
  currentUserId: number,
  targetUserId: number,
) {
  store.friendships = store.friendships.filter(
    (friendship) =>
      !(
        (friendship.userA === currentUserId && friendship.userB === targetUserId) ||
        (friendship.userA === targetUserId && friendship.userB === currentUserId)
      ),
  );
  store.friendRequests = store.friendRequests.filter(
    (request) =>
      !(
        (request.fromUserId === currentUserId && request.toUserId === targetUserId) ||
        (request.fromUserId === targetUserId && request.toUserId === currentUserId)
      ),
  );
}

export function listFriendIds(store: FriendStoreShape, userId: number) {
  return store.friendships.flatMap((friendship) => {
    if (friendship.userA === userId) return [friendship.userB];
    if (friendship.userB === userId) return [friendship.userA];
    return [];
  });
}

export function listIncomingFriendRequests(store: FriendStoreShape, userId: number) {
  return store.friendRequests.filter((request) => request.toUserId === userId);
}

export function listOutgoingFriendRequests(store: FriendStoreShape, userId: number) {
  return store.friendRequests.filter((request) => request.fromUserId === userId);
}

export function updateFriendPresence(
  userId: number,
  input: {
    online?: boolean;
    isPlaying?: boolean;
    currentTrack?: FriendPresenceTrack | null;
  },
) {
  const previous = presenceByUserId.get(userId);
  const nextCurrentTrack =
    input.isPlaying === false ? null : input.currentTrack ?? previous?.currentTrack ?? null;
  const nextLastTrack =
    nextCurrentTrack || previous?.currentTrack || previous?.lastTrack || null;

  const nextState: FriendPresenceState = {
    online: input.online ?? previous?.online ?? true,
    isPlaying: input.isPlaying ?? previous?.isPlaying ?? false,
    currentTrack: nextCurrentTrack,
    lastTrack: nextLastTrack,
    updatedAt: Date.now(),
  };

  presenceByUserId.set(userId, nextState);
  return nextState;
}

export function getFriendPresence(userId: number) {
  const state = presenceByUserId.get(userId);
  if (!state) {
    return {
      online: false,
      isPlaying: false,
      currentTrack: null,
      lastTrack: null,
      updatedAt: 0,
    };
  }

  if (Date.now() - state.updatedAt > PRESENCE_STALE_MS) {
    return {
      ...state,
      online: false,
      isPlaying: false,
      currentTrack: null,
    };
  }

  return state;
}


