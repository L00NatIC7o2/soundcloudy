import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const token = req.cookies.soundcloud_token;
    const refreshToken = req.cookies.soundcloud_refresh_token;

    console.log(
      "Auth check - token exists:",
      !!token,
      "refresh exists:",
      !!refreshToken,
    );

    if (!token && refreshToken) {
      try {
        const params = new URLSearchParams({
          client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
          client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });

        const refreshResponse = await axios.post(
          "https://api.soundcloud.com/oauth2/token",
          params.toString(),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        const newToken = refreshResponse.data.access_token;
        const newRefreshToken =
          refreshResponse.data.refresh_token || refreshToken;
        const expiresIn = refreshResponse.data.expires_in || 3600;

        const cookies = [
          `soundcloud_token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}`,
          `soundcloud_refresh_token=${newRefreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
        ];

        res.setHeader("Set-Cookie", cookies);
        return res.json({ authenticated: true });
      } catch (refreshError: any) {
        console.error(
          "Token refresh failed:",
          refreshError.response?.data || refreshError.message,
        );
        res.setHeader("Set-Cookie", [
          "soundcloud_token=; Path=/; Max-Age=0",
          "soundcloud_refresh_token=; Path=/; Max-Age=0",
        ]);
        return res
          .status(401)
          .json({ error: "Token expired - please log in again" });
      }
    }

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify token by calling a simple endpoint
    try {
      await axios.get("https://api.soundcloud.com/me", {
        headers: { Authorization: `OAuth ${token}` },
        timeout: 5000,
      });

      console.log("Auth check passed - token still valid");
      res.json({ authenticated: true });
    } catch (error: any) {
      if (error.response?.status === 401 && refreshToken) {
        // Token expired, try to refresh
        console.log("Token expired, attempting refresh...");
        try {
          const params = new URLSearchParams({
            client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
            client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          });

          const refreshResponse = await axios.post(
            "https://api.soundcloud.com/oauth2/token",
            params.toString(),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            },
          );

          const newToken = refreshResponse.data.access_token;
          const newRefreshToken =
            refreshResponse.data.refresh_token || refreshToken;
          const expiresIn = refreshResponse.data.expires_in || 3600;

          console.log("Token refreshed successfully - expires in:", expiresIn);

          // Set new tokens
          const cookies = [
            `soundcloud_token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}`,
            `soundcloud_refresh_token=${newRefreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
          ];

          res.setHeader("Set-Cookie", cookies);
          res.json({ authenticated: true });
        } catch (refreshError: any) {
          console.error(
            "Token refresh failed:",
            refreshError.response?.data || refreshError.message,
          );
          res.setHeader("Set-Cookie", [
            "soundcloud_token=; Path=/; Max-Age=0",
            "soundcloud_refresh_token=; Path=/; Max-Age=0",
          ]);
          res
            .status(401)
            .json({ error: "Token expired - please log in again" });
        }
      } else {
        console.error("Auth verification failed");
        res.setHeader("Set-Cookie", "soundcloud_token=; Path=/; Max-Age=0");
        res.status(401).json({ error: "Not authenticated" });
      }
    }
  } catch (error: any) {
    console.error("Auth check error:", error.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}
