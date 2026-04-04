import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getConnectStore } from "../../../apps/backend/src/server/auth/connectStore";
import {
  generateCodeChallenge,
  generateCodeVerifier,
} from "../../../apps/backend/src/server/auth/pkce";
import { getAuthCallbackUrl } from "../../../apps/backend/src/server/http/origin";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    const requestedRedirect =
      typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : null;
    const requestedState =
      typeof req.query.state === "string" ? req.query.state : null;
    const redirectUri = requestedRedirect
      ? requestedRedirect
      : getAuthCallbackUrl(req);

    console.log("[auth/login] entered", {
      method: req.method,
      host: req.headers.host || null,
      origin: req.headers.origin || null,
      hasClientId: Boolean(clientId),
      requestedRedirect,
      redirectUri,
      requestedState,
    });

    if (!clientId) {
      console.error("[auth/login] missing SOUNDCLOUD_CLIENT_ID");
      return res.status(500).json({
        error: "Missing SOUNDCLOUD_CLIENT_ID env var",
      });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = requestedState || crypto.randomUUID();

    const store = getConnectStore();
    store.set(state, {
      createdAt: Date.now(),
      expires_in: 600,
      status: "pending",
      codeVerifier,
    });

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
    url.searchParams.set("state", state);

    console.log("[auth/login] redirecting to SoundCloud", {
      state,
      redirectUri,
    });

    res.redirect(url.toString());
  } catch (error) {
    console.error("[auth/login] fatal error", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown login error",
    });
  }
}
