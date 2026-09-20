import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const fetchLikesResponse = async (
  endpoint: string,
  auth: SoundCloudAuthContext,
  params?: Record<string, unknown>,
) => {
  return await axios.get(endpoint, {
    headers: {
      Authorization: auth.headerValue,
    },
    params,
    timeout: 10000,
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { nextHref, limit = "50" } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
    if (auth && !sessionState) {
      sessionState = await getStoredSoundCloudSession(req, res);
    }
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated", likes: [] });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    console.warn("Likes route missing userId, falling back to /me likes");
  }

  try {
    const limitNum = Math.min(parseInt(limit as string) || 50, 50);
    const endpoint =
      typeof nextHref === "string" && nextHref.length > 0
        ? nextHref
        : currentUserId
          ? `https://api.soundcloud.com/users/${currentUserId}/likes/tracks`
          : "https://api.soundcloud.com/me/likes/tracks";
    const endpointParams =
      typeof nextHref === "string" && nextHref.length > 0
        ? undefined
        : {
            limit: limitNum,
            linked_partitioning: true,
          };

    let response;
    try {
      console.log("Likes route - calling SoundCloud endpoint:", endpoint);
      console.log(
        "Likes route - current session userId:",
        sessionState?.session?.userId,
        "tokens.userId:",
        sessionState?.tokens?.userId,
      );
      console.log("Likes route - auth header present:", !!auth?.headerValue);
      response = await fetchLikesResponse(endpoint, auth, endpointParams);
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.warn(
          "Likes route - received 401 from SoundCloud, attempting refresh",
        );
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        console.log(
          "Likes route - refresh result:",
          !!refreshedAuth?.headerValue,
        );
        if (!refreshedAuth) {
          return res.status(200).json({
            likes: [],
            hasMore: false,
            nextHref: null,
            transientAuthError: true,
          });
        }

        auth = refreshedAuth;
        const retryEndpoint =
          typeof nextHref === "string" && nextHref.length > 0
            ? endpoint
            : currentUserId
              ? endpoint
              : "https://api.soundcloud.com/me/likes/tracks";
        try {
          response = await fetchLikesResponse(
            retryEndpoint,
            refreshedAuth,
            endpointParams,
          );
        } catch (retryError: any) {
          if (retryError.response?.status === 401) {
            return res.status(200).json({
              likes: [],
              hasMore: false,
              nextHref: null,
              transientAuthError: true,
            });
          }

          throw retryError;
        }
      } else if (
        typeof nextHref !== "string" &&
        [404, 405].includes(error.response?.status)
      ) {
        response = await fetchLikesResponse(
          "https://api.soundcloud.com/me/likes/tracks",
          auth,
          {
            limit: limitNum,
            linked_partitioning: true,
          },
        );
      } else {
        throw error;
      }
    }

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
      return res.status(200).json({
        likes: [],
        hasMore: false,
        nextHref: null,
        transientAuthError: true,
      });
    }

    res.status(error.response?.status || 500).json({ likes: [] });
  }
}
