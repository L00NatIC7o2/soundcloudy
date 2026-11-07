import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { requireSoundCloudAccessToken } from "../../src/server/auth/soundcloud";

let playReportsDisabledUntil = 0;
let playReportsDisabledIndefinitely = false;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const trackId = String(req.body?.trackId || "").trim();
  if (!/^\d+$/.test(trackId)) {
    return res.status(400).json({ success: false, error: "A valid track ID is required" });
  }

  if (playReportsDisabledIndefinitely || Date.now() < playReportsDisabledUntil) {
    return res.status(429).json({
      success: false,
      note: "Play reports disabled after SoundCloud rate limited this endpoint",
      disabled: true,
      ...(playReportsDisabledUntil
        ? { reset: Math.ceil(playReportsDisabledUntil / 1000) }
        : {}),
    });
  }

  const token = await requireSoundCloudAccessToken(req, res);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Match the legacy SoundCloud JS SDK's play-registration request shape:
    // client_id in the query string and an empty POST body.
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({
        success: false,
        error: "SoundCloud client ID is not configured",
      });
    }

    const response = await axios.post(
      `https://api.soundcloud.com/tracks/${encodeURIComponent(trackId)}/plays`,
      null,
      {
        params: { client_id: clientId },
        headers: { Accept: "application/json" },
        timeout: 8000,
      },
    );

    return res.json({ success: true, status: response.status });
  } catch (error: any) {
    const status = error.response?.status;
    const retryAfterHeader = error.response?.headers?.["retry-after"];
    const rateLimitHeaders = {
      limit: error.response?.headers?.["x-ratelimit-limit"] || null,
      remaining: error.response?.headers?.["x-ratelimit-remaining"] || null,
      reset: error.response?.headers?.["x-ratelimit-reset"] || null,
      retryAfter: retryAfterHeader || null,
    };
    let reset = Number(error.response?.headers?.["x-ratelimit-reset"]);
    if (status === 429) {
      if (Number.isFinite(reset) && reset > 0) {
        playReportsDisabledUntil = Math.max(Date.now(), reset * 1000) + 3000;
        playReportsDisabledIndefinitely = false;
      } else {
        const retryAfterSeconds = Number(retryAfterHeader);
        if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
          playReportsDisabledUntil = Date.now() + retryAfterSeconds * 1000 + 3000;
          reset = Math.ceil(playReportsDisabledUntil / 1000);
        } else {
          playReportsDisabledUntil = 0;
          playReportsDisabledIndefinitely = true;
        }
      }
    }
    console.warn("SoundCloud play report failed:", {
      trackId,
      status: status || null,
      rateLimit: status === 429 ? rateLimitHeaders : null,
      message: error.message,
    });
    return res.status(status === 429 ? 429 : 502).json({
      success: false,
      note: "SoundCloud did not accept the play report",
      upstreamStatus: status || null,
      ...(status === 429
        ? {
            disabled: true,
            rateLimit: rateLimitHeaders,
            ...(reset > 0 ? { reset } : {}),
          }
        : {}),
    });
  }
}

