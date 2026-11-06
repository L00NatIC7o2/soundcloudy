import type { NextApiRequest, NextApiResponse } from "next";
import axios, { type AxiosResponse } from "axios";
import {
  getRequestSoundCloudAuthContext,
  getStoredSoundCloudSession,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";
import {
  getPersonalDataCache,
  setPersonalDataCache,
} from "../../apps/backend/src/server/cache/personalData";

interface SoundCloudCollectionResponse<T = any> {
  collection?: T[];
  next_href?: string | null;
}

const fetchPaginatedCollection = async (
  url: string,
  auth: SoundCloudAuthContext,
  limit = 200,
) => {
  const collection: any[] = [];
  let nextUrl: string | null = url;
  let isFirstRequest = true;

  while (nextUrl) {
    const response: AxiosResponse<SoundCloudCollectionResponse> =
      await axios.get(nextUrl, {
        headers: {
          Authorization: auth.headerValue,
        },
        params: isFirstRequest ? { limit, linked_partitioning: 1 } : undefined,
        timeout: 10000,
      });

    collection.push(...(response.data?.collection || []));
    nextUrl = response.data?.next_href || null;
    isFirstRequest = false;
  }

  return collection;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, playlistId } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);
  let sessionState = await getStoredSoundCloudSession(req, res);

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
    if (auth && !sessionState) {
      sessionState = await getStoredSoundCloudSession(req, res);
    }
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const currentUserId = Number(
    sessionState?.session?.userId || sessionState?.tokens?.userId || 0,
  );

  if (!currentUserId) {
    return res.status(401).json({
      error: "Not authenticated",
      isInAnyPlaylist: false,
      playlistsWithTrack: [],
    });
  }

  const numericTrackId = Number(trackId);
  const numericPlaylistId = playlistId ? Number(playlistId) : null;
  const cacheKey = `track-membership:${numericTrackId}:${numericPlaylistId || "all"}`;
  const cachedMembership = getPersonalDataCache<{
    isInAnyPlaylist: boolean;
    playlistsWithTrack: any[];
  }>(currentUserId, cacheKey);
  if (cachedMembership) {
    return res.json(cachedMembership);
  }

  try {
    const trackIdNum = parseInt(trackId as string);

    if (playlistId) {
      const targetPlaylistId = parseInt(playlistId as string);
      try {
        const tracks = await fetchPaginatedCollection(
          `https://api.soundcloud.com/playlists/${targetPlaylistId}/tracks`,
          auth,
          200,
        );
        const isInPlaylist = tracks.some((item: any) => {
          const track = item?.track || item;
          return track?.id === trackIdNum;
        });

        const result = {
          isInAnyPlaylist: isInPlaylist,
          playlistsWithTrack: isInPlaylist ? [{ id: targetPlaylistId }] : [],
        };
        setPersonalDataCache(currentUserId, cacheKey, result, 2 * 60 * 1000);
        return res.json(result);
      } catch (error) {
        if ((error as any)?.response?.status === 429) {
          throw error;
        }
        console.warn(`Could not check playlist ${playlistId}`);
        return res.json({ isInAnyPlaylist: false, playlistsWithTrack: [] });
      }
    }

    // Fetch user's playlists
    const playlists = await fetchPaginatedCollection(
      `https://api.soundcloud.com/users/${currentUserId}/playlists`,
      auth,
      100,
    );
    const ownedPlaylists = playlists.filter(
      (playlist: any) => Number(playlist?.user?.id) === currentUserId,
    );
    const playlistsWithTrack: any[] = [];

    // Check each playlist for the track
    for (const playlist of ownedPlaylists) {
      try {
        const tracks = await fetchPaginatedCollection(
          `https://api.soundcloud.com/playlists/${playlist.id}/tracks`,
          auth,
          200,
        );
        const isInPlaylist = tracks.some((item: any) => {
          const track = item?.track || item;
          return track?.id === trackIdNum;
        });

        if (isInPlaylist) {
          playlistsWithTrack.push({
            id: playlist.id,
            title: playlist.title,
            artwork_url: playlist.artwork_url,
          });
        }
      } catch (error) {
        if ((error as any)?.response?.status === 429) {
          throw error;
        }
        // Skip playlists we can't access
        console.warn(`Could not check playlist ${playlist.id}`);
      }
    }

    const result = {
      isInAnyPlaylist: playlistsWithTrack.length > 0,
      playlistsWithTrack,
    };
    setPersonalDataCache(currentUserId, cacheKey, result, 2 * 60 * 1000);
    res.json(result);
  } catch (error: any) {
    if ([401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (refreshedAuth) {
          const trackIdNum = parseInt(trackId as string);

          if (playlistId) {
            const targetPlaylistId = parseInt(playlistId as string);
            const tracks = await fetchPaginatedCollection(
              `https://api.soundcloud.com/playlists/${targetPlaylistId}/tracks`,
              refreshedAuth,
              200,
            );
            const isInPlaylist = tracks.some((item: any) => {
              const track = item?.track || item;
              return track?.id === trackIdNum;
            });

            return res.json({
              isInAnyPlaylist: isInPlaylist,
              playlistsWithTrack: isInPlaylist
                ? [{ id: targetPlaylistId }]
                : [],
            });
          }

          const playlists = await fetchPaginatedCollection(
            `https://api.soundcloud.com/users/${currentUserId}/playlists`,
            refreshedAuth,
            100,
          );
          const ownedPlaylists = playlists.filter(
            (playlist: any) => Number(playlist?.user?.id) === currentUserId,
          );
          const playlistsWithTrack: any[] = [];

          for (const playlist of ownedPlaylists) {
            try {
              const tracks = await fetchPaginatedCollection(
                `https://api.soundcloud.com/playlists/${playlist.id}/tracks`,
                refreshedAuth,
                200,
              );
              const isInPlaylist = tracks.some((item: any) => {
                const track = item?.track || item;
                return track?.id === trackIdNum;
              });

              if (isInPlaylist) {
                playlistsWithTrack.push({
                  id: playlist.id,
                  title: playlist.title,
                  artwork_url: playlist.artwork_url,
                });
              }
            } catch (playlistError) {
              if ((playlistError as any)?.response?.status === 429) {
                throw playlistError;
              }
              console.warn(`Could not check playlist ${playlist.id}`);
            }
          }

          return res.json({
            isInAnyPlaylist: playlistsWithTrack.length > 0,
            playlistsWithTrack,
          });
        }
      } catch (refreshError: any) {
        console.error(
          "Check playlists refresh error:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error(
      "Check playlists error:",
      error.response?.status,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
        isInAnyPlaylist: false,
        playlistsWithTrack: [],
      });
    }

    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"];
      if (retryAfter) {
        res.setHeader("Retry-After", retryAfter);
      }
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to check playlists",
      isInAnyPlaylist: false,
      playlistsWithTrack: [],
    });
  }
}
