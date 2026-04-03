import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../apps/backend/src/server/auth/connectStore";
import { establishSoundCloudSession } from "../../../apps/backend/src/server/auth/soundcloud";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    const accessToken =
      typeof req.body?.access_token === "string" ? req.body.access_token : null;
    const refreshToken =
      typeof req.body?.refresh_token === "string"
        ? req.body.refresh_token
        : undefined;
    const expiresIn =
      typeof req.body?.expires_in === "number"
        ? req.body.expires_in
        : Number(req.body?.expires_in) || 3600;

    if (!accessToken) {
      return res.status(400).json({ error: "Missing access_token" });
    }

    await establishSoundCloudSession(
      req,
      res,
      accessToken,
      refreshToken,
      expiresIn,
    );

    return res.status(200).json({ ok: true });
  }

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
