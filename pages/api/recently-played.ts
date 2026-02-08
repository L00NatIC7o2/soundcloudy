import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const getRecentlyPlayed = async (req: NextApiRequest) => {
  const token = req.cookies.soundcloud_token;
  const v2ClientId =
    process.env.SOUNDCLOUD_V2_CLIENT_ID || "2-312569-189576713-EF8sAzE2OOkPKj";
  const clientId = v2ClientId || process.env.SOUNDCLOUD_CLIENT_ID;
  const rawLimit = Array.isArray(req.query.limit)
    ? req.query.limit[0]
    : req.query.limit;
  const parsedLimit = Number(rawLimit);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 200)
      : 50;

  console.log("/api/recently-played debug:", {
    token: token ? token.slice(0, 6) + "..." : undefined,
    clientId,
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
        limit,
        client_id: clientId,
      },
    });
    let response;

    try {
      response = await axios.get(apiUrl, {
        params: {
          limit,
          client_id: clientId,
        },
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      });
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        // Fallback to oauth_token param if header auth is rejected
        response = await axios.get(apiUrl, {
          params: {
            limit,
            client_id: clientId,
            oauth_token: token,
          },
          timeout: 10000,
        });
      } else {
        throw e;
      }
    }
    // Each item: { track: { ... }, played_at: ... }
    const items = response.data.collection || [];
    // Return just the track objects, but keep played_at if needed
    return items.map((item: any) => ({
      ...item.track,
      played_at: item.played_at,
    }));
  } catch (e: any) {
    if (e?.response?.status === 403 || e?.response?.status === 401) {
      console.error("/api/recently-played v2 auth failed:", {
        status: e?.response?.status,
        data: e?.response?.data,
        headers: e?.response?.headers,
        config: e?.config,
        request: e?.request,
      });

      // Fallback to v1 activities feed (often works when v2 is blocked)
      try {
        const activitiesUrl = "https://api.soundcloud.com/me/activities";
        const activityResponse = await axios.get(activitiesUrl, {
          params: { limit },
          headers: {
            Authorization: `OAuth ${token}`,
          },
          timeout: 10000,
        });

        const collection = activityResponse.data?.collection || [];
        const items = collection
          .map((item: any) => item.origin)
          .filter(
            (origin: any) =>
              origin &&
              ["track", "playlist", "playlist-like"].includes(origin.kind),
          );

        return items.map((item: any) => ({
          ...item,
          played_at: item?.last_modified || item?.created_at || null,
        }));
      } catch (fallbackError: any) {
        console.error("/api/recently-played v1 fallback failed:", {
          status: fallbackError?.response?.status,
          data: fallbackError?.response?.data,
          headers: fallbackError?.response?.headers,
          config: fallbackError?.config,
          request: fallbackError?.request,
        });
      }

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
    const items = await getRecentlyPlayed(req);
    res.status(200).json({ items });
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
