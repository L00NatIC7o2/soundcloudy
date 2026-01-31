import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { IncomingMessage } from "http";

// Helper to get last 5 unique-artist tracks from recently played
async function getRecentUniqueTracks(req: IncomingMessage) {
  // Call the recently-played API route
  const baseUrl = req.headers.host?.startsWith("localhost")
    ? `http://${req.headers.host}`
    : `https://${req.headers.host}`;
  const res = await fetch(`${baseUrl}/api/recently-played`, {
    headers: { cookie: req.headers.cookie || "" },
  });
  const data = await res.json();
  const seenArtists = new Set();
  const uniqueTracks = [];
  for (const t of data.tracks || []) {
    if (t.user && !seenArtists.has(t.user.id)) {
      seenArtists.add(t.user.id);
      uniqueTracks.push(t);
    }
    if (uniqueTracks.length >= 5) break;
  }
  return uniqueTracks;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let { trackId, for: forHomepage } = req.query;
  const token = req.cookies.soundcloud_token;

  // If called for homepage, aggregate related tracks from last 5 unique-artist tracks
  if (!trackId && forHomepage) {
    const recentTracks = await getRecentUniqueTracks(req);
    if (!recentTracks.length) {
      // fallback
      trackId = "308946187";
    } else {
      // For each unique track, fetch related tracks and merge
      const allRelated: any[] = [];
      const seenTrackIds = new Set();
      for (const t of recentTracks) {
        try {
          const response = await axios.get(
            `https://api.soundcloud.com/tracks/${t.id}/related`,
            {
              headers: {
                Authorization: `OAuth ${token}`,
              },
              params: {
                limit: 10,
                linked_partitioning: true,
                access: "playable,preview",
              },
              timeout: 10000,
            },
          );
          const tracks = response.data.collection || response.data || [];
          for (const track of tracks) {
            if (!seenTrackIds.has(track.id)) {
              seenTrackIds.add(track.id);
              allRelated.push(track);
            }
          }
        } catch (e) {
          // Ignore errors for individual tracks
        }
      }
      return res.json({ tracks: allRelated });
    }
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const response = await axios.get(
      `https://api.soundcloud.com/tracks/${trackId}/related`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        params: {
          limit: 20,
          linked_partitioning: true,
          access: "playable,preview",
        },
        timeout: 10000,
      },
    );
    // SoundCloud returns { collection: [...], next_href: ... }
    const tracks = response.data.collection || response.data || [];
    res.json({ tracks });
  } catch (error: any) {
    console.error(
      "Related tracks error:",
      error.response?.status,
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({ tracks: [] });
  }
}
