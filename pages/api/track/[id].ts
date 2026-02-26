import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import puppeteer from "puppeteer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  // Use the provided OAuth token for v2api requests
  // Retrieve the user's OAuth token from cookies and ensure correct format for v2api
  let token = req.cookies.soundcloud_token;
  const isLikelyJwt = token && token.split(".").length === 3;
  if (!token || isLikelyJwt) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (token && !token.startsWith("OAuth ")) {
    token = `OAuth ${token}`;
  }
  console.log("[track-api] Using Authorization header:", token);
  if (!id) return res.status(400).json({ error: "Missing track id" });

  try {
    // Fetch track details
    let trackRes;
    try {
      trackRes = await axios.get(`https://api-v2.soundcloud.com/tracks/${id}`, {
        headers: token ? { Authorization: token } : {},
      });
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        // Fallback to oauth_token param if header auth is rejected
        trackRes = await axios.get(
          `https://api-v2.soundcloud.com/tracks/${id}`,
          {
            params: { oauth_token: token },
          },
        );
      } else {
        throw e;
      }
    }
    const track = trackRes.data;
    console.log("[track-api] Track response:", JSON.stringify(track, null, 2));

    // Fetch comments
    let commentsRes;
    try {
      commentsRes = await axios.get(
        `https://api-v2.soundcloud.com/tracks/${id}/comments`,
        {
          headers: token ? { Authorization: token } : {},
          params: { limit: 50 },
        },
      );
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        commentsRes = await axios.get(
          `https://api-v2.soundcloud.com/tracks/${id}/comments`,
          {
            params: { limit: 50, oauth_token: token },
          },
        );
      } else {
        throw e;
      }
    }
    const comments = (commentsRes.data.collection || []).map((c: any) => ({
      id: c.id,
      user: {
        username: c.user.username,
        permalink_url: `https://soundcloud.com/${c.user.permalink}`,
        avatar_url: c.user.avatar_url,
      },
      body: c.body,
      timestamp: c.timestamp,
    }));
    console.log(
      "[track-api] Comments response:",
      JSON.stringify(commentsRes.data, null, 2),
    );

    // Fetch related tracks
    const relatedRes = await axios.get(
      `https://api-v2.soundcloud.com/tracks/${id}/related`,
      {
        headers: token ? { Authorization: token } : {},
        params: { limit: 8 },
      },
    );
    const related_tracks = (relatedRes.data.collection || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: {
        username: t.user.username,
        permalink_url: `https://soundcloud.com/${t.user.permalink}`,
      },
      artwork_url: t.artwork_url,
    }));
    console.log(
      "[track-api] Related tracks response:",
      JSON.stringify(relatedRes.data, null, 2),
    );

    // Track bio and stats
    const bio = track.description || "";
    const play_count = track.playback_count || 0;
    const likes_count = track.likes_count || 0;
    const reposts_count = track.reposts_count || 0;

    res.json({
      id: track.id,
      title: track.title,
      artist: {
        username: track.user.username,
        permalink_url: `https://soundcloud.com/${track.user.permalink}`,
        avatar_url: track.user.avatar_url,
      },
      play_count,
      likes_count,
      reposts_count,
      bio,
      comments,
      related_tracks,
    });
  } catch (e: any) {
    console.log("[track-api] Error:", e);
    res.status(500).json({ error: e.message });
  }
}
