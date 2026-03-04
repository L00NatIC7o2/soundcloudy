import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trackId, like } = req.body;
  const token = req.cookies.soundcloud_token;

  if (!token) {
    console.warn("/api/like called without token cookie");
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Normalize token for header usage. Some flows store the raw token, others include "OAuth " prefix.
  let authHeader = token;
  const isLikelyJwt =
    typeof token === "string" && token.split(".").length === 3;
  if (isLikelyJwt) {
    console.warn("/api/like received JWT token, will reject");
    // JWT not acceptable for API v1 like endpoints
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!String(token).startsWith("OAuth ")) {
    authHeader = `OAuth ${token}`;
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    if (like) {
      // Like: POST to /likes/tracks/{trackId}
      await axios.post(
        `https://api.soundcloud.com/likes/tracks/${trackId}`,
        {},
        {
          headers: { Authorization: authHeader },
          timeout: 5000,
        },
      );
    } else {
      // Unlike: DELETE to /likes/tracks/{trackId}
      await axios.delete(`https://api.soundcloud.com/likes/tracks/${trackId}`, {
        headers: { Authorization: authHeader },
        timeout: 5000,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    // Log full error response for debugging
    console.error(
      "Like error:",
      error?.response?.status,
      error?.response?.data,
      error.message,
    );
    let errorMsg = "Failed to update like";
    // If SoundCloud returned 404 or auth issues, try a fallback that uses oauth_token param
    const status = error?.response?.status;
    if (status === 404 || status === 401 || status === 403) {
      try {
        if (like) {
          await axios.post(
            `https://api.soundcloud.com/likes/tracks/${trackId}`,
            {},
            {
              params: { oauth_token: token },
              timeout: 5000,
            },
          );
        } else {
          await axios.delete(
            `https://api.soundcloud.com/likes/tracks/${trackId}`,
            {
              params: { oauth_token: token },
              timeout: 5000,
            },
          );
        }
        return res.json({ success: true });
      } catch (err2: any) {
        console.error(
          "Like fallback error:",
          err2?.response?.status,
          err2?.response?.data,
          err2?.message,
        );
        if (
          err2?.response?.data?.errors &&
          Array.isArray(err2.response.data.errors)
        ) {
          errorMsg = err2.response.data.errors
            .map((e: any) => e.error_message || e)
            .join("; ");
        } else if (typeof err2?.response?.data === "string") {
          errorMsg = err2.response.data;
        } else if (err2?.response?.data?.error) {
          errorMsg = err2.response.data.error;
        }
        return res
          .status(err2.response?.status || 500)
          .json({ error: errorMsg });
      }
    }

    if (
      error?.response?.data?.errors &&
      Array.isArray(error.response.data.errors)
    ) {
      errorMsg = error.response.data.errors
        .map((e: any) => e.error_message || e)
        .join("; ");
    } else if (typeof error?.response?.data === "string") {
      errorMsg = error.response.data;
    } else if (error?.response?.data?.error) {
      errorMsg = error.response.data.error;
    }
    res.status(error.response?.status || 500).json({ error: errorMsg });
  }
}
