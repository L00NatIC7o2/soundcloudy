import type { NextApiRequest, NextApiResponse } from "next";
import { requireFriendAuth } from "../../../src/server/friends/api";
import { updateFriendPresence } from "../../../src/server/friends/store";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireFriendAuth(req, res);
  if (!auth) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const track = req.body?.track && typeof req.body.track === "object"
    ? {
        id: Number(req.body.track.id || 0),
        title: String(req.body.track.title || ""),
        artist: String(req.body.track.artist || "Unknown"),
        artwork: req.body.track.artwork ? String(req.body.track.artwork) : null,
      }
    : null;

  const presence = updateFriendPresence(auth.userId, {
    online: req.body?.online !== false,
    isPlaying: Boolean(req.body?.isPlaying),
    currentTrack: track && track.id ? track : null,
  });

  return res.status(200).json({ ok: true, presence });
}
