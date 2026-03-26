import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { IncomingMessage } from "http";
import {
  getRequestSoundCloudAuthContext,
  refreshSoundCloudAuth,
  type SoundCloudAuthContext,
} from "../../src/server/auth/soundcloud";

async function getRecentUniqueTracks(req: IncomingMessage) {
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

const fetchRelatedTracks = async (
  trackId: string | number,
  auth: SoundCloudAuthContext,
  limit: number,
) => {
  const response = await axios.get(
    `https://api.soundcloud.com/tracks/${trackId}/related`,
    {
      headers: {
        Authorization: auth.headerValue,
      },
      params: {
        limit,
        linked_partitioning: true,
        access: "playable,preview",
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
  let { trackId, for: forHomepage } = req.query;
  const normalizedTrackId = Array.isArray(trackId) ? trackId[0] : trackId;
  let auth = await getRequestSoundCloudAuthContext(req, res);

  if (!auth) {
    auth = await refreshSoundCloudAuth(req, res);
  }

  if (!normalizedTrackId && forHomepage) {
    const recentTracks = await getRecentUniqueTracks(req);
    if (!recentTracks.length) {
      trackId = "308946187";
    } else {
      if (!auth) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allRelated: any[] = [];
      const seenTrackIds = new Set();
      let activeAuth = auth;

      for (const t of recentTracks) {
        try {
          const tracks = await fetchRelatedTracks(t.id, activeAuth, 10);
          for (const track of tracks) {
            if (!seenTrackIds.has(track.id)) {
              seenTrackIds.add(track.id);
              allRelated.push(track);
            }
          }
        } catch (error: any) {
          if ([401, 403].includes(error.response?.status)) {
            try {
              const refreshedAuth = await refreshSoundCloudAuth(req, res);
              if (refreshedAuth) {
                activeAuth = refreshedAuth;
                const tracks = await fetchRelatedTracks(t.id, activeAuth, 10);
                for (const track of tracks) {
                  if (!seenTrackIds.has(track.id)) {
                    seenTrackIds.add(track.id);
                    allRelated.push(track);
                  }
                }
              }
            } catch (refreshError: any) {
              console.error(
                "Homepage related refresh error:",
                refreshError.response?.data || refreshError.message,
              );
            }
          }
        }
      }

      return res.json({ tracks: allRelated.slice(0, 20) });
    }
  }

  if (!normalizedTrackId && !trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const tracks = await fetchRelatedTracks(normalizedTrackId || trackId!, auth, 20);
    res.json({ tracks });
  } catch (error: any) {
    if ([401, 403].includes(error.response?.status)) {
      try {
        const refreshedAuth = await refreshSoundCloudAuth(req, res);
        if (refreshedAuth) {
          const tracks = await fetchRelatedTracks(
            normalizedTrackId || trackId!,
            refreshedAuth,
            20,
          );
          return res.json({ tracks });
        }
      } catch (refreshError: any) {
        console.error(
          "Related tracks refresh error:",
          refreshError.response?.data || refreshError.message,
        );
      }
    }

    console.error(
      "Related tracks error:",
      error.response?.status,
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({ tracks: [] });
  }
}
