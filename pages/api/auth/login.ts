import type { NextApiRequest, NextApiResponse } from "next";
import {
  generateCodeChallenge,
  generateCodeVerifier,
} from "../../../src/server/auth/pkce";
import { getAuthCallbackUrl } from "../../../src/server/http/origin";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const requestedRedirect =
    typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const redirectUri = requestedRedirect
    ? requestedRedirect
    : getAuthCallbackUrl(req);

  if (!clientId) {
    return res.status(500).json({
      error: "Missing SOUNDCLOUD_CLIENT_ID env var",
    });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  res.setHeader(
    "Set-Cookie",
    `soundcloud_code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  );

  const url = new URL("https://soundcloud.com/connect");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "non-expiring");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (state) {
    url.searchParams.set("state", state);
  }

  res.redirect(url.toString());
}
