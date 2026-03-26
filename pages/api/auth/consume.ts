import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../src/server/auth/connectStore";
import { establishSoundCloudSession } from "../../../src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const connectCode =
    typeof req.query.connect_code === "string"
      ? req.query.connect_code
      : typeof req.query.nonce === "string"
        ? req.query.nonce
        : null;

  if (!connectCode) {
    return res.status(400).json({ error: "Missing connect_code" });
  }

  const store = getConnectStore();
  const entry = store.get(connectCode);

  if (!entry || !entry.tokens) {
    return res.status(401).json({ error: "Invalid or incomplete session" });
  }

  const { access_token, refresh_token, expires_in } = entry.tokens;
  store.delete(connectCode);

  if (!access_token || typeof access_token !== "string") {
    return res.status(401).json({ error: "Invalid SoundCloud session" });
  }

  await establishSoundCloudSession(
    req,
    res,
    access_token,
    typeof refresh_token === "string" ? refresh_token : undefined,
    typeof expires_in === "number" ? expires_in : 3600,
  );

  res.redirect(302, "/");
}
