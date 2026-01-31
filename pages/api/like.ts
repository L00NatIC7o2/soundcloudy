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
    return res.status(401).json({ error: "Not authenticated" });
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
          headers: { Authorization: `OAuth ${token}` },
          timeout: 5000,
        },
      );
    } else {
      // Unlike: DELETE to /likes/tracks/{trackId}
      await axios.delete(`https://api.soundcloud.com/likes/tracks/${trackId}`, {
        headers: { Authorization: `OAuth ${token}` },
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
    res.status(error.response?.status || 500).json({
      error: errorMsg,
    });
  }
}
