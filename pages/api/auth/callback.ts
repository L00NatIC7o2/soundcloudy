import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  extractSoundCloudV2ClientId,
  saveEnvFile,
} from "../../../scripts/extract-sc-v2-id";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, error } = req.query;

  console.log("Callback received - code exists:", !!code, "error:", error);

  if (error) {
    return res.redirect(`/login?error=${error}`);
  }

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;

    console.log("Exchanging code for token...");
    console.log("Redirect URI:", redirectUri);

    const params = new URLSearchParams({
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code,
    });

    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    console.log("Token received!");
    console.log("Access token:", access_token?.substring(0, 20) + "...");
    console.log("Expires in:", expires_in);
    console.log("Has refresh token:", !!refresh_token);

    if (!access_token) {
      throw new Error("No access token in response");
    }

    // Store both tokens
    const cookies = [
      `soundcloud_token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expires_in || 3600}`,
    ];

    if (refresh_token) {
      cookies.push(
        `soundcloud_refresh_token=${refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      );
    }

    console.log("Setting cookies and redirecting...");
    res.setHeader("Set-Cookie", cookies);

    // Extract and save SoundCloud V2 Client ID if not already set
    if (
      !process.env.SOUNDCLOUD_V2_CLIENT_ID ||
      process.env.SOUNDCLOUD_V2_CLIENT_ID.length === 0
    ) {
      console.log("Extracting SoundCloud V2 Client ID...");
      try {
        const v2ClientId = await extractSoundCloudV2ClientId(access_token);
        if (v2ClientId) {
          saveEnvFile({ SOUNDCLOUD_V2_CLIENT_ID: v2ClientId });
          console.log("✓ SoundCloud V2 Client ID saved to .env.local");
        } else {
          console.warn(
            "⚠ Could not extract V2 Client ID. User may need to manually add it.",
          );
        }
      } catch (err) {
        console.error(
          "Error during V2 Client ID extraction:",
          err instanceof Error ? err.message : String(err),
        );
        // Don't fail auth just because we couldn't extract the V2 ID
      }
    }

    res.redirect(302, "/");
  } catch (error: any) {
    console.error(
      "Auth callback error:",
      error.response?.data || error.message,
    );

    const errorMsg =
      error.response?.data?.error_description ||
      error.response?.data?.error ||
      "auth_failed";

    res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
  }
}
