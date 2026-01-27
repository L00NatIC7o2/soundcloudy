import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;
  const scope = "non-expiring";

  const authUrl = new URL("https://soundcloud.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);

  res.redirect(authUrl.toString());
}
