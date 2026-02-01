import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const getRecentlyPlayed = async (req: NextApiRequest) => {
  const token = req.cookies.soundcloud_token;
  // Prefer V2 client ID from env, fallback to provided, then v1
  const v2ClientId =
    process.env.SOUNDCLOUD_V2_CLIENT_ID || "2-312569-189576713-EF8sAzE2OOkPKj";
  const clientId = v2ClientId || process.env.SOUNDCLOUD_CLIENT_ID;
  // Log token and clientId (mask token for security)
  console.log("/api/recently-played debug:", {
    token: token ? token.slice(0, 6) + "..." : undefined,
    clientId,
    cookies: req.headers.cookie,
    env: {
      SOUNDCLOUD_V2_CLIENT_ID: process.env.SOUNDCLOUD_V2_CLIENT_ID,
      SOUNDCLOUD_CLIENT_ID: process.env.SOUNDCLOUD_CLIENT_ID,
    },
    method: req.method,
    url: req.url,
    headers: req.headers,
  });
  if (!token || !clientId) {
    console.error("Not authenticated or missing v2 client ID", {
      token,
      clientId,
    });
    throw new Error("Not authenticated or missing v2 client ID");
  }
  try {
    // Use SoundCloud v2 API for listening history
    const apiUrl = "https://api-v2.soundcloud.com/me/track_history";
    console.log("Requesting SoundCloud v2 play history:", apiUrl, {
      params: {
        limit: 50,
        client_id: clientId,
        oauth_token: token,
      },
    });
    const response = await axios.get(apiUrl, {
      params: {
        limit: 50,
        client_id: clientId,
        oauth_token: token,
      },
      timeout: 10000,
    });
    // Each item: { track: { ... }, played_at: ... }
    const items = response.data.collection || [];
    // Return just the track objects, but keep played_at if needed
    return items.map((item: any) => ({
      ...item.track,
      played_at: item.played_at,
    }));
  } catch (e: any) {
    if (e?.response?.status === 403) {
      console.error("/api/recently-played 403 Forbidden:", {
        data: e?.response?.data,
        headers: e?.response?.headers,
        config: e?.config,
        request: e?.request,
      });
      throw new Error(
        "SoundCloud authorization failed (403). Please re-login or check your account permissions.",
      );
    }
    console.error("/api/recently-played axios error:", {
      message: e?.message,
      response: e?.response,
      config: e?.config,
      request: e?.request,
      stack: e?.stack,
    });
    throw e;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const tracks = await getRecentlyPlayed(req);
    res.status(200).json({ tracks });
  } catch (e: any) {
    console.error("/api/recently-played handler error:", {
      message: e?.message,
      response: e?.response,
      config: e?.config,
      request: e?.request,
      stack: e?.stack,
      error: e,
    });
    res
      .status(500)
      .json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
