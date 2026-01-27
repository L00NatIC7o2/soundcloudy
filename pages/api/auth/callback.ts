import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    console.log("Exchanging code for token...");
    console.log("Client ID:", process.env.SOUNDCLOUD_CLIENT_ID);
    console.log(
      "Client Secret exists:",
      !!process.env.SOUNDCLOUD_CLIENT_SECRET,
    );
    console.log(
      "Redirect URI:",
      `${process.env.NEXTAUTH_URL}/api/auth/callback`,
    );

    const params = new URLSearchParams({
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
    });

    console.log("Token request params:", params.toString());

    const tokenResp = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await tokenResp.json();
    console.log("Token response status:", tokenResp.status);
    console.log("Token response:", tokenData);

    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return res.redirect(
        `/?error=token_exchange_failed&details=${encodeURIComponent(
          JSON.stringify(tokenData),
        )}`,
      );
    }

    const cookie = [
      `soundcloud_token=${tokenData.access_token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=31536000",
    ];
    if (process.env.NEXTAUTH_URL?.startsWith("https://")) {
      cookie.push("Secure");
    }
    res.setHeader("Set-Cookie", cookie.join("; "));
    res.redirect("/");
  } catch (err: any) {
    console.error("Auth callback error:", err);
    res.redirect(`/?error=auth_error`);
  }
}
