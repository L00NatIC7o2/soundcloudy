import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export type SoundCloudAuthContext = {
  rawToken: string;
  headerValue: string;
  queryValue: string;
};

export const getSoundCloudAuthContext = (
  rawToken?: string,
): SoundCloudAuthContext | null => {
  if (!rawToken) return null;

  const normalized = rawToken.replace(/^OAuth\s+/i, "").trim();

  if (!normalized) return null;

  return {
    rawToken: normalized,
    headerValue: `OAuth ${normalized}`,
    queryValue: normalized,
  };
};

export const setSoundCloudAuthCookies = (
  res: NextApiResponse,
  accessToken: string,
  refreshToken?: string,
  expiresIn = 3600,
) => {
  const isProd = process.env.NODE_ENV === "production";
  const cookies = [
    `soundcloud_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}${isProd ? "; Secure" : ""}`,
  ];

  if (refreshToken) {
    cookies.push(
      `soundcloud_refresh_token=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isProd ? "; Secure" : ""}`,
    );
  }

  res.setHeader("Set-Cookie", cookies);
};

export const clearSoundCloudAuthCookies = (res: NextApiResponse) => {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", [
    `soundcloud_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`,
    `soundcloud_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`,
  ]);
};

export const refreshSoundCloudAuth = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<SoundCloudAuthContext | null> => {
  const refreshToken = req.cookies.soundcloud_refresh_token;

  if (!refreshToken) {
    return null;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let response;
  try {
    response = await axios.post(
      "https://secure.soundcloud.com/oauth/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      },
    );
  } catch (error: any) {
    if (error.response?.data?.error === "invalid_grant") {
      clearSoundCloudAuthCookies(res);
      req.cookies.soundcloud_token = "";
      req.cookies.soundcloud_refresh_token = "";
      return null;
    }
    throw error;
  }

  const accessToken = response.data?.access_token;
  const nextRefreshToken = response.data?.refresh_token || refreshToken;
  const expiresIn = response.data?.expires_in || 3600;

  if (!accessToken) {
    return null;
  }

  req.cookies.soundcloud_token = accessToken;
  req.cookies.soundcloud_refresh_token = nextRefreshToken;
  setSoundCloudAuthCookies(res, accessToken, nextRefreshToken, expiresIn);

  return getSoundCloudAuthContext(accessToken);
};
