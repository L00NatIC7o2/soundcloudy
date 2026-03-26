import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
} from "../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { nextHref, limit = "50" } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated", likes: [] });
  }

  try {
    const limitNum = Math.min(parseInt(limit as string) || 50, 50);
    const endpoint =
      typeof nextHref === "string" && nextHref.length > 0
        ? nextHref
        : "https://api.soundcloud.com/me/likes/tracks";

    const response = await axios.get(endpoint, {
      headers: {
        Authorization: auth.headerValue,
      },
      params:
        typeof nextHref === "string" && nextHref.length > 0
          ? undefined
          : {
              limit: limitNum,
              linked_partitioning: true,
            },
      timeout: 10000,
    });

    const rawLikes = Array.isArray(response.data)
      ? response.data
      : response.data?.collection || [];
    const likes = rawLikes
      .map((item: any) => item?.track || item)
      .filter((item: any) => item && item.id)
      .map((track: any) => ({
        ...track,
        isLiked: true,
      }));

    const next =
      typeof response.data?.next_href === "string" && response.data.next_href
        ? response.data.next_href
        : null;

    res.json({ likes, hasMore: Boolean(next), nextHref: next });
  } catch (error: any) {
    console.error(
      "Likes error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated", likes: [] });
    }

    res.status(error.response?.status || 500).json({ likes: [] });
  }
}
