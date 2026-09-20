import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

const fetchPlaylist = async (
  playlistId: string | number,
  auth: SoundCloudAuthContext,
) => {
  return await axios.get(`https://api.soundcloud.com/playlists/${playlistId}`, {
    headers: { Authorization: auth.headerValue },
    timeout: 10000,
  });
};

const updatePlaylist = async (
  playlistId: string | number,
  tracks: any[],
  auth: SoundCloudAuthContext,
) => {
  return await axios.put(
    `https://api.soundcloud.com/playlists/${playlistId}`,
    {
      playlist: {
        tracks: tracks.map((track: any) => ({
          id: String(track.id),
        })),
      },
    },
    {
      headers: {
        Authorization: auth.headerValue,
        "Content-Type": "application/json",
      },
    },
  );
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.body;
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
    let playlistResponse;
    try {
      playlistResponse = await fetchPlaylist(playlistId, auth);
    } catch (error: any) {
      if (error.response?.status === 401) {
        const refreshedAuth = await refreshSoundCloudAuth(req, res, {
          force: true,
        });
        if (!refreshedAuth) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        auth = refreshedAuth;
        playlistResponse = await fetchPlaylist(playlistId, refreshedAuth);
      } else {
        throw error;
      }
    }

    const tracks = Array.isArray(playlistResponse.data?.tracks)
      ? playlistResponse.data.tracks
      : [];
    const filteredTracks = tracks.filter(
      (track: any) => Number(track?.id) !== Number(trackId),
    );

    await updatePlaylist(playlistId, filteredTracks, auth);

    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}

