import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { playlistId, trackId } = req.body;
  let token = req.cookies.soundcloud_token;

  console.log("/api/add-to-playlist called", { playlistId, trackId });

  if (!token) {
    console.warn("add-to-playlist: missing auth token");
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (token && !token.startsWith("OAuth ")) {
    token = `OAuth ${token}`;
  }

  try {
    // Step 1: Get existing playlist to preserve existing tracks
    console.log("Fetching existing playlist tracks...");
    const getResp = await axios.get(
      `https://api.soundcloud.com/playlists/${playlistId}`,
      {
        headers: { Authorization: token },
      },
    );

    const existingTracks = getResp.data.tracks || [];
    console.log("Existing tracks count:", existingTracks.length);

    // Step 2: Check if track already exists
    if (existingTracks.some((t: any) => t.id === trackId)) {
      console.log("Track already in playlist");
      return res.status(400).json({ error: "Track already in playlist" });
    }

    // Step 3: Add new track to the list (keep only id field for each track, as strings)
    const updatedTracks = [
      ...existingTracks.map((t: any) => ({ id: String(t.id) })),
      { id: String(trackId) },
    ];

    // Step 4: Update playlist with PUT (correct API method)
    console.log("Updating playlist with PUT...");
    const payload = {
      playlist: {
        tracks: updatedTracks,
      },
    };
    console.log("Payload being sent:", JSON.stringify(payload));
    console.log(
      "Track IDs:",
      updatedTracks.map((t) => ({ id: t.id, type: typeof t.id })),
    );

    const putResp = await axios.put(
      `https://api.soundcloud.com/playlists/${playlistId}`,
      payload,
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("add-to-playlist success");
    res.json({ success: true });
  } catch (error: any) {
    console.error(
      "add-to-playlist error",
      error.response?.status,
      error.response?.data || error.message,
    );
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Unknown error";
    res.status(status).json({ error: message });
  }
}
