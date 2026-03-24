import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../src/server/auth/connectStore";
import { getAuthCallbackUrl } from "../../../src/server/http/origin";

// Helper to ensure we access the same global store for Bridge/Connect flows
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, state } = req.query;
  const verifier = req.cookies.soundcloud_code_verifier;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  // PKCE Check: We need the verifier created in login.ts
  if (!verifier) {
    return res
      .status(400)
      .json({ error: "Missing code_verifier. Please restart login." });
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const redirectUri = getAuthCallbackUrl(req);

  if (!clientId || !clientSecret) {
    return res
      .status(500)
      .json({ error: "SOUNDCLOUD_CLIENT_ID/SECRET not set in .env" });
  }

  try {
    const tokenRes = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code,
        code_verifier: verifier,
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        error: "SoundCloud token exchange failed",
        details: tokenJson,
      });
    }

    if (state && typeof state === "string") {
      const store = getConnectStore();
      if (store.has(state)) {
        store.set(state, {
          ...store.get(state),
          status: "complete",
          tokens: tokenJson,
          createdAt: Date.now(),
          expires_in: Number(tokenJson.expires_in) || 600,
        });

        res.setHeader("Content-Type", "text/html");
        return res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1>Successfully Connected!</h1>
              <p>You can close this window and return to your other device.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }
    }

    const isProd = process.env.NODE_ENV === "production";
    const cookies = [
      `soundcloud_token=${tokenJson.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${tokenJson.expires_in || 3600}${isProd ? "; Secure" : ""}`,
      `soundcloud_code_verifier=; Path=/; Max-Age=0`,
    ];

    if (tokenJson.refresh_token) {
      cookies.push(
        `soundcloud_refresh_token=${tokenJson.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isProd ? "; Secure" : ""}`,
      );
    }

    res.setHeader("Set-Cookie", cookies);
    return res.redirect(302, "/");
  } catch (error: any) {
    console.error("Callback Error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during callback" });
  }
}

