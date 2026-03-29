import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getStoredSoundCloudSession,
  requireSoundCloudAccessToken,
} from "../auth/soundcloud";
import type { StoredFriendUser } from "./store";

const FRIEND_CODE_PREFIX = "SCY";

export async function requireFriendAuth(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = await requireSoundCloudAccessToken(req, res);
  const sessionState = await getStoredSoundCloudSession(req, res);
  const userId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!token || !userId) {
    return null;
  }

  return { token, userId, sessionState };
}

export async function fetchSoundCloudUserById(token: string, userId: number) {
  const response = await axios.get(`https://api.soundcloud.com/users/${userId}`, {
    headers: { Authorization: `OAuth ${token}` },
    timeout: 10000,
  });
  const user = response.data;
  return {
    userId: Number(user.id),
    username: String(user.username || user.permalink || `User ${user.id}`),
    avatarUrl: user.avatar_url || null,
    permalink: user.permalink || null,
  } satisfies StoredFriendUser;
}

export async function fetchCurrentSoundCloudUser(token: string) {
  const response = await axios.get("https://api.soundcloud.com/me", {
    headers: { Authorization: `OAuth ${token}` },
    timeout: 10000,
  });
  const user = response.data;
  return {
    userId: Number(user.id),
    username: String(user.username || user.permalink || `User ${user.id}`),
    avatarUrl: user.avatar_url || null,
    permalink: user.permalink || null,
  } satisfies StoredFriendUser;
}

export async function searchSoundCloudUsers(token: string, query: string) {
  const response = await axios.get("https://api.soundcloud.com/users", {
    headers: { Authorization: `OAuth ${token}` },
    params: {
      q: query,
      limit: 8,
    },
    timeout: 10000,
  });

  const collection = Array.isArray(response.data?.collection)
    ? response.data.collection
    : Array.isArray(response.data)
      ? response.data
      : [];

  return collection.map((user: any) => ({
    userId: Number(user.id),
    username: String(user.username || user.permalink || `User ${user.id}`),
    avatarUrl: user.avatar_url || null,
    permalink: user.permalink || null,
  })) satisfies StoredFriendUser[];
}

export function buildFriendCode(userId: number) {
  return `${FRIEND_CODE_PREFIX}-${userId.toString(36).toUpperCase()}`;
}

export function parseFriendCode(input: string) {
  const normalized = String(input || "")
    .trim()
    .toUpperCase();
  const match = normalized.match(/^SCY-([0-9A-Z]+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 36);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
