import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

function generateCodeVerifier(): string {
  // Generate a random string 43-128 characters long (alphanumeric + - _ .)
  const length = 128;
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCodeChallenge(verifier: string): string {
  // SHA256(verifier) and base64url encode it
  const hash = crypto.createHash("sha256").update(verifier).digest();
  // base64url encoding (no padding, + -> -, / -> _)
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const requestedRedirect =
    typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const redirectUri = requestedRedirect
    ? requestedRedirect
    : process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback`
      : undefined;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "Missing SOUNDCLOUD_CLIENT_ID or NEXTAUTH_URL env vars",
    });
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store code_verifier in a secure cookie for the callback to use
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
