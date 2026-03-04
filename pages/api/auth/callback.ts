import type { NextApiRequest, NextApiResponse } from "next";

// Helper to ensure we access the same global store for Bridge/Connect flows
const getStore = () => {
  const globalAny = globalThis as any;
  if (!globalAny.__SC_CONNECT_CODES) {
    globalAny.__SC_CONNECT_CODES = new Map<string, any>();
  }
  return globalAny.__SC_CONNECT_CODES;
};

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
  const base = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    return res
      .status(500)
      .json({ error: "SOUNDCLOUD_CLIENT_ID/SECRET not set in .env" });
  }

  try {
    // 1. Exchange the code for actual tokens
    const tokenRes = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code: code,
        code_verifier: verifier, // REQUIRED for PKCE
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        error: "SoundCloud token exchange failed",
        details: tokenJson,
      });
    }

    // 2. Handle the "Bridge" flow (if a state/connect_code exists)
    if (state && typeof state === "string") {
      const store = getStore();
      if (store.has(state)) {
        store.set(state, {
          ...store.get(state),
          status: "complete",
          tokens: tokenJson,
          createdAt: Date.now(),
        });

        // Return a simple 'close window' page for the bridge user
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

    // 3. Standard Login Flow (if not using bridge, set cookies directly)
    const isProd = process.env.NODE_ENV === "production";
    const cookies = [
      `soundcloud_token=${tokenJson.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${tokenJson.expires_in || 3600}${isProd ? "; Secure" : ""}`,
      // Clear the verifier cookie as it's no longer needed
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
