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
    console.log("Token value:", token?.substring(0, 20) + "...");

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify token by calling a simple endpoint
    try {
      const meResponse = await axios.get("https://api.soundcloud.com/me", {
        headers: { Authorization: `OAuth ${token}` },
        timeout: 5000,
      });

      console.log("Auth check passed - user:", meResponse.data.username);
      res.json({ authenticated: true, user: meResponse.data });
    } catch (error: any) {
      console.error(
        "Token verification failed:",
        error.response?.status,
        error.response?.data,
      );

      if (error.response?.status === 401 && refreshToken) {
        // Try to refresh token
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
          const expiresIn = refreshResponse.data.expires_in || 3600;

          res.setHeader(
            "Set-Cookie",
            `soundcloud_token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}`,
          );

          console.log("Token refreshed successfully");
          res.json({ authenticated: true });
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          res.setHeader("Set-Cookie", [
            "soundcloud_token=; Path=/; Max-Age=0",
            "soundcloud_refresh_token=; Path=/; Max-Age=0",
          ]);
          res.status(401).json({ error: "Token expired" });
        }
      } else {
        console.error("Auth verification failed - clearing cookies");
        res.setHeader("Set-Cookie", "soundcloud_token=; Path=/; Max-Age=0");
        res.status(401).json({ error: "Not authenticated" });
      }
    }
  } catch (error: any) {
    console.error("Auth check error:", error.message);
    res.status(500).json({ error: "Auth check failed" });
  }
}
