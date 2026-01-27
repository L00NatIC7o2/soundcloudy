import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;
  const scope = "non-expiring";

  const url = new URL("https://soundcloud.com/connect");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);

  res.redirect(url.toString());
}
