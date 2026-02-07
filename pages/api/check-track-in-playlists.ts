import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { trackId, playlistId } = req.query;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    const trackIdNum = parseInt(trackId as string);

    if (playlistId) {
      const targetPlaylistId = parseInt(playlistId as string);
      try {
        const tracksResponse = await axios.get(
          `https://api.soundcloud.com/playlists/${targetPlaylistId}/tracks`,
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              limit: 200,
              linked_partitioning: 1,
            },
            timeout: 5000,
          },
        );

        const tracks = tracksResponse.data.collection || [];
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
    const playlistsResponse = await axios.get(
      "https://api.soundcloud.com/me/playlists",
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 100,
          linked_partitioning: 1,
        },
        timeout: 10000,
      },
    );

    const playlists = playlistsResponse.data.collection || [];
    const playlistsWithTrack: any[] = [];

    // Check each playlist for the track
    for (const playlist of playlists) {
      try {
        const tracksResponse = await axios.get(
          `https://api.soundcloud.com/playlists/${playlist.id}/tracks`,
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              limit: 200,
              linked_partitioning: 1,
            },
            timeout: 5000,
          },
        );

        const tracks = tracksResponse.data.collection || [];
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
