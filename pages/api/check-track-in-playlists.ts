import type { NextApiRequest, NextApiResponse } from "next";
import axios, { type AxiosResponse } from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

interface SoundCloudCollectionResponse<T = any> {
  collection?: T[];
  next_href?: string | null;
}

const fetchPaginatedCollection = async (
  url: string,
  token: string,
  limit = 200,
) => {
  const collection: any[] = [];
  let nextUrl: string | null = url;
  let isFirstRequest = true;

  while (nextUrl) {
    const response: AxiosResponse<SoundCloudCollectionResponse> =
      await axios.get(nextUrl, {
      headers: {
        Authorization: `OAuth ${token}`,
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
  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    const trackIdNum = parseInt(trackId as string);
    const meResponse = await axios.get("https://api.soundcloud.com/me", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 10000,
    });
    const currentUserId = Number(meResponse.data?.id);

    if (playlistId) {
      const targetPlaylistId = parseInt(playlistId as string);
      try {
        const tracks = await fetchPaginatedCollection(
          `https://api.soundcloud.com/playlists/${targetPlaylistId}/tracks`,
          token,
          200,
        );
        const isInPlaylist = tracks.some((item: any) => {
          const track = item?.track || item;
          return track?.id === trackIdNum;
        });

        return res.json({
          isInAnyPlaylist: isInPlaylist,
          playlistsWithTrack: isInPlaylist ? [{ id: targetPlaylistId }] : [],
        });
      } catch (error) {
        console.warn(`Could not check playlist ${playlistId}`);
        return res.json({ isInAnyPlaylist: false, playlistsWithTrack: [] });
      }
    }

    // Fetch user's playlists
    const playlists = await fetchPaginatedCollection(
      "https://api.soundcloud.com/me/playlists",
      token,
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
          token,
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
        // Skip playlists we can't access
        console.warn(`Could not check playlist ${playlist.id}`);
      }
    }

    res.json({
      isInAnyPlaylist: playlistsWithTrack.length > 0,
      playlistsWithTrack,
    });
  } catch (error: any) {
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

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to check playlists",
      isInAnyPlaylist: false,
      playlistsWithTrack: [],
    });
  }
}

