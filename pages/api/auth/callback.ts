import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../src/server/auth/connectStore";
import { establishSoundCloudSession } from "../../../src/server/auth/soundcloud";
import { getAuthCallbackUrl } from "../../../src/server/http/origin";

// Helper to ensure we access the same global store for Bridge/Connect flows
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, state } = req.query;
  const verifier = req.cookies.soundcloud_code_verifier;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  if (!verifier) {
    res
      .status(400)
      .json({ error: "Missing code_verifier. Please restart login." });
    return;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const redirectUri = getAuthCallbackUrl(req);

  if (!clientId || !clientSecret) {
    res
      .status(500)
      .json({ error: "SOUNDCLOUD_CLIENT_ID/SECRET not set in .env" });
    return;
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
      res.status(tokenRes.status).json({
        error: "SoundCloud token exchange failed",
        details: tokenJson,
      });
      return;
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
        res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1>Successfully Connected!</h1>
              <p>You can close this window and return to your other device.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
        return;
      }
    }

    await establishSoundCloudSession(
      req,
      res,
      tokenJson.access_token,
      tokenJson.refresh_token,
      tokenJson.expires_in || 3600,
    );

    res.setHeader(
      "Set-Cookie",
      [
        ...(Array.isArray(res.getHeader("Set-Cookie"))
          ? (res.getHeader("Set-Cookie") as string[])
          : res.getHeader("Set-Cookie")
            ? [String(res.getHeader("Set-Cookie"))]
            : []),
        "soundcloud_code_verifier=; Path=/; Max-Age=0",
      ],
    );
    res.redirect(302, "/");
    return;
  } catch (error: any) {
    console.error("Callback Error:", error);
    res
      .status(500)
      .json({ error: "Internal server error during callback" });
    return;
  }
}
