import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const fetchPlaylistTracks = async (
  playlistId: string,
  auth: SoundCloudAuthContext,
) => {
  const response = await axios.get(
    `https://api.soundcloud.com/playlists/${playlistId}/tracks`,
    {
      headers: {
        Authorization: auth.headerValue,
      },
      params: {
        limit: 200,
        linked_partitioning: 1,
      },
      timeout: 10000,
    },
  );

  return response.data.collection || response.data || [];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.query;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!playlistId || !trackId) {
    return res.status(400).json({ error: "Missing playlistId or trackId" });
  }

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const tracks = await fetchPlaylistTracks(String(playlistId), auth);
    const trackIdNum = parseInt(trackId as string);

    const isInPlaylist = tracks.some((item: any) => {
      const track = item?.track || item;
      return track?.id === trackIdNum;
    });

    res.json({ isInPlaylist });
  } catch (error: any) {
    if ([401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (refreshedAuth) {
          const tracks = await fetchPlaylistTracks(String(playlistId), refreshedAuth);
          const trackIdNum = parseInt(trackId as string);
          const isInPlaylist = tracks.some((item: any) => {
            const track = item?.track || item;
            return track?.id === trackIdNum;
          });

          return res.json({ isInPlaylist });
        }
      } catch (refreshError: any) {
        console.error(
          "Check playlist refresh error:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error(
      "Check playlist error:",
      error.response?.status,
      error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Token expired or invalid",
        isInPlaylist: false,
      });
    }

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || "Failed to check playlist",
      isInPlaylist: false,
    });
  }
}

