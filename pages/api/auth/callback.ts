import type { NextApiRequest, NextApiResponse } from "next";

// Ensure we use the same global store as bridge.ts
const getStore = () => {
  const globalAny = globalThis as any;
  if (!globalAny.__SC_CONNECT_CODES) {
    globalAny.__SC_CONNECT_CODES = new Map<string, any>();
  }
  return globalAny.__SC_CONNECT_CODES;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing code" });
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const base = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
  const redirectUri = `${base.replace(/\\/$/, "")}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Client config missing" });
  }

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      }),
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({ error: "SoundCloud token exchange failed", details: tokenJson });
    }

    // 2. Handle Bridge vs Standard Flow
    if (state && typeof state === "string") {
      const store = getStore();
      const entry = store.get(state);

      if (entry) {
        // Update the bridge entry so the polling 'complete.ts' can see it
        store.set(state, {
          ...entry,
          status: "complete",
          tokens: tokenJson,
        });

        return res.send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1>Connected!</h1>
              <p>You can close this window now.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
      }
    }

    // 3. Standard Login Fallback (Sets cookies directly)
    const isProd = process.env.NODE_ENV === "production";
    const cookies = [
      `soundcloud_token=${tokenJson.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${tokenJson.expires_in || 3600}${isProd ? "; Secure" : ""}`,
    ];

    if (tokenJson.refresh_token) {
      cookies.push(
        `soundcloud_refresh_token=${tokenJson.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isProd ? "; Secure" : ""}`
      );
    }

    res.setHeader("Set-Cookie", cookies);
    return res.redirect(302, "/");

  } catch (error: any) {
    console.error("Callback error:", error);
    return res.status(500).json({ error: "Internal server error during callback" });
  }
}