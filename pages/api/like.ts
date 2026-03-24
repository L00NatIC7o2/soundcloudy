import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const getAuthContext = (rawToken?: string) => {
  if (!rawToken) return null;

  const normalized = rawToken.replace(/^OAuth\s+/, "");

  return {
    headerValue: `OAuth ${normalized}`,
    queryValue: normalized,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { trackId, like } = req.body;
  const auth = getAuthContext(req.cookies.soundcloud_token);

  if (!auth) {
    console.warn("/api/like called without token cookie");
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!trackId) {
    return res.status(400).json({ error: "Missing trackId" });
  }

  try {
    if (like) {
      await axios.post(
        `https://api.soundcloud.com/likes/tracks/${trackId}`,
        {},
        {
          headers: { Authorization: auth.headerValue },
          timeout: 5000,
        },
      );
    } else {
      await axios.delete(`https://api.soundcloud.com/likes/tracks/${trackId}`, {
        headers: { Authorization: auth.headerValue },
        timeout: 5000,
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error(
      "Like error:",
      error?.response?.status,
      error?.response?.data,
      error.message,
    );

    let errorMsg = "Failed to update like";
    const status = error?.response?.status;

    if (status === 404 || status === 401 || status === 403) {
      try {
        if (like) {
          await axios.post(
            `https://api.soundcloud.com/likes/tracks/${trackId}`,
            {},
            {
              params: { oauth_token: auth.queryValue },
              timeout: 5000,
            },
          );
        } else {
          await axios.delete(`https://api.soundcloud.com/likes/tracks/${trackId}`, {
            params: { oauth_token: auth.queryValue },
            timeout: 5000,
          });
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

    return res.status(error.response?.status || 500).json({ error: errorMsg });
  }
}
