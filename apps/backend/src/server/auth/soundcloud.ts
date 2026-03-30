import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export type SoundCloudAuthContext = {
  rawToken: string;
  headerValue: string;
  queryValue: string;
};

export type SoundCloudWebCredentials = {
  clientId: string;
  appVersion?: string | null;
  appLocale?: string | null;
  updatedAt?: number;
};

type RefreshResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null;

type StoredUserTokens = {
  userId: string;
  username?: string | null;
  accessToken: string;
  refreshToken?: string;
  webCredentials?: SoundCloudWebCredentials | null;
  expiresAt: number;
  updatedAt: number;
};

type StoredAppSession = {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
};

declare global {
  var __SC_USER_TOKENS: Map<string, StoredUserTokens> | undefined;
  var __SC_APP_SESSIONS: Map<string, StoredAppSession> | undefined;
}

const SESSION_COOKIE = "soundcloudy_session";
const REFRESH_GRACE_MS = 30_000;
const SESSION_MAX_AGE = 31536000;
const DEFAULT_WEB_APP_LOCALE = process.env.SOUNDCLOUD_APP_LOCALE || "en";
const refreshLocks = new Map<string, Promise<RefreshResult>>();

const getTokenStore = () => {
  if (!globalThis.__SC_USER_TOKENS) {
    globalThis.__SC_USER_TOKENS = new Map<string, StoredUserTokens>();
  }
  return globalThis.__SC_USER_TOKENS;
};

const getSessionStore = () => {
  if (!globalThis.__SC_APP_SESSIONS) {
    globalThis.__SC_APP_SESSIONS = new Map<string, StoredAppSession>();
  }
  return globalThis.__SC_APP_SESSIONS;
};

const appendSetCookieHeader = (res: NextApiResponse, cookies: string[]) => {
  const existing = res.getHeader("Set-Cookie");
  const current = Array.isArray(existing)
    ? existing.map(String)
    : existing
      ? [String(existing)]
      : [];
  res.setHeader("Set-Cookie", [...current, ...cookies]);
};

const getCookieSecuritySuffix = () =>
  process.env.NODE_ENV === "production" ? "; Secure" : "";

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
  const suffix = getCookieSecuritySuffix();
  const cookies = [
    `soundcloud_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}${suffix}`,
  ];

  if (refreshToken) {
    cookies.push(
      `soundcloud_refresh_token=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${suffix}`,
    );
  }

  appendSetCookieHeader(res, cookies);
};

export const clearSoundCloudAuthCookies = (res: NextApiResponse) => {
  const suffix = getCookieSecuritySuffix();
  appendSetCookieHeader(res, [
    `soundcloud_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${suffix}`,
    `soundcloud_refresh_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${suffix}`,
  ]);
};

export const setSoundCloudSessionCookie = (
  res: NextApiResponse,
  sessionId: string,
) => {
  const suffix = getCookieSecuritySuffix();
  appendSetCookieHeader(res, [
    `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${suffix}`,
  ]);
};

export const clearSoundCloudSessionCookie = (res: NextApiResponse) => {
  const suffix = getCookieSecuritySuffix();
  appendSetCookieHeader(res, [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${suffix}`,
  ]);
};

const fetchSoundCloudUser = async (accessToken: string) => {
  const response = await axios.get("https://api.soundcloud.com/me", {
    headers: {
      Authorization: `OAuth ${accessToken}`,
    },
    timeout: 10000,
  });

  const userId = String(response.data?.id || "");
  if (!userId) {
    throw new Error("Missing SoundCloud user id");
  }

  return {
    userId,
    username: response.data?.username || null,
  };
};

const persistUserTokens = (
  userId: string,
  accessToken: string,
  refreshToken?: string,
  expiresIn = 3600,
  username?: string | null,
  webCredentials?: SoundCloudWebCredentials | null,
) => {
  const previous = getTokenStore().get(userId);
  const tokens: StoredUserTokens = {
    userId,
    username: username ?? previous?.username ?? null,
    accessToken,
    refreshToken,
    webCredentials: webCredentials ?? previous?.webCredentials ?? null,
    expiresAt: Date.now() + expiresIn * 1000,
    updatedAt: Date.now(),
  };
  getTokenStore().set(userId, tokens);
  return tokens;
};

const createAppSession = (userId: string) => {
  const sessionId = crypto.randomUUID();
  const session: StoredAppSession = {
    sessionId,
    userId,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  getSessionStore().set(sessionId, session);
  return session;
};

const touchAppSession = (sessionId: string) => {
  const session = getSessionStore().get(sessionId);
  if (session) {
    session.lastSeenAt = Date.now();
    getSessionStore().set(sessionId, session);
  }
  return session;
};

const clearSessionFromStores = (sessionId?: string, userId?: string) => {
  if (sessionId) {
    getSessionStore().delete(sessionId);
  }
  if (userId) {
    getTokenStore().delete(userId);
    for (const [id, session] of getSessionStore()) {
      if (session.userId === userId) {
        getSessionStore().delete(id);
      }
    }
  }
};

const syncRequestCookies = (
  req: NextApiRequest,
  accessToken?: string,
  refreshToken?: string,
  sessionId?: string,
) => {
  if (typeof accessToken === "string") {
    req.cookies.soundcloud_token = accessToken;
  }
  if (typeof refreshToken === "string") {
    req.cookies.soundcloud_refresh_token = refreshToken;
  }
  if (typeof sessionId === "string") {
    req.cookies[SESSION_COOKIE] = sessionId;
  }
};

const getSessionStateFromRequest = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const sessionId = req.cookies[SESSION_COOKIE];

  if (sessionId) {
    const session = touchAppSession(sessionId);
    const tokens = session ? getTokenStore().get(session.userId) : undefined;
    if (session && tokens) {
      syncRequestCookies(
        req,
        tokens.accessToken,
        tokens.refreshToken,
        session.sessionId,
      );
      setSoundCloudSessionCookie(res, session.sessionId);
      setSoundCloudAuthCookies(
        res,
        tokens.accessToken,
        tokens.refreshToken,
        Math.max(60, Math.ceil((tokens.expiresAt - Date.now()) / 1000)),
      );
      return {
        session,
        tokens,
      };
    }

    clearSessionFromStores(sessionId);
    clearSoundCloudSessionCookie(res);
  }

  const legacyAccessToken = req.cookies.soundcloud_token;
  if (!legacyAccessToken) {
    return null;
  }

  try {
    const user = await fetchSoundCloudUser(legacyAccessToken);
    const tokens = persistUserTokens(
      user.userId,
      legacyAccessToken,
      req.cookies.soundcloud_refresh_token,
      3600,
      user.username,
    );
    const session = createAppSession(user.userId);
    setSoundCloudSessionCookie(res, session.sessionId);
    setSoundCloudAuthCookies(
      res,
      tokens.accessToken,
      tokens.refreshToken,
      3600,
    );
    syncRequestCookies(
      req,
      tokens.accessToken,
      tokens.refreshToken,
      session.sessionId,
    );
    return { session, tokens };
  } catch {
    return null;
  }
};

export const getStoredSoundCloudSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  return await getSessionStateFromRequest(req, res);
};

const sanitizeWebCredentials = (
  webCredentials?: Partial<SoundCloudWebCredentials> | null,
) => {
  if (!webCredentials?.clientId) return null;
  return {
    clientId: String(webCredentials.clientId),
    appVersion: webCredentials.appVersion
      ? String(webCredentials.appVersion)
      : null,
    appLocale: webCredentials.appLocale
      ? String(webCredentials.appLocale)
      : DEFAULT_WEB_APP_LOCALE,
    updatedAt: Date.now(),
  } satisfies SoundCloudWebCredentials;
};

export const setSoundCloudWebCredentialsForUser = (
  userId: string,
  webCredentials?: Partial<SoundCloudWebCredentials> | null,
) => {
  const sanitized = sanitizeWebCredentials(webCredentials);
  if (!sanitized) return null;
  const existing = getTokenStore().get(userId);
  if (!existing) return null;
  const nextTokens: StoredUserTokens = {
    ...existing,
    webCredentials: sanitized,
    updatedAt: Date.now(),
  };
  getTokenStore().set(userId, nextTokens);
  return sanitized;
};

export const setRequestSoundCloudWebCredentials = async (
  req: NextApiRequest,
  res: NextApiResponse,
  webCredentials?: Partial<SoundCloudWebCredentials> | null,
) => {
  const sessionState = await getSessionStateFromRequest(req, res);
  const userId = sessionState?.session?.userId;
  if (!userId) return null;
  return setSoundCloudWebCredentialsForUser(userId, webCredentials);
};

export const getRequestSoundCloudWebCredentials = async (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const sessionState = await getSessionStateFromRequest(req, res);
  const credentials = sessionState?.tokens?.webCredentials;
  if (credentials?.clientId) {
    return {
      clientId: credentials.clientId,
      appVersion: credentials.appVersion || null,
      appLocale: credentials.appLocale || DEFAULT_WEB_APP_LOCALE,
      updatedAt: credentials.updatedAt || Date.now(),
    } satisfies SoundCloudWebCredentials;
  }
  return null;
};
export const establishSoundCloudSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
  accessToken: string,
  refreshToken?: string,
  expiresIn = 3600,
  webCredentials?: Partial<SoundCloudWebCredentials> | null,
) => {
  const user = await fetchSoundCloudUser(accessToken);
  const tokens = persistUserTokens(
    user.userId,
    accessToken,
    refreshToken,
    expiresIn,
    user.username,
    sanitizeWebCredentials(webCredentials),
  );
  const existingSessionId = req.cookies[SESSION_COOKIE];
  const existingSession = existingSessionId
    ? getSessionStore().get(existingSessionId)
    : null;
  const session =
    existingSession && existingSession.userId === user.userId
      ? existingSession
      : createAppSession(user.userId);

  setSoundCloudSessionCookie(res, session.sessionId);
  setSoundCloudAuthCookies(
    res,
    tokens.accessToken,
    tokens.refreshToken,
    expiresIn,
  );
  syncRequestCookies(req, tokens.accessToken, tokens.refreshToken, session.sessionId);

  return {
    sessionId: session.sessionId,
    userId: user.userId,
    username: user.username,
    tokens,
  };
};

export const clearSoundCloudSession = (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  const sessionId = req.cookies[SESSION_COOKIE];
  const session = sessionId ? getSessionStore().get(sessionId) : null;
  clearSessionFromStores(sessionId, session?.userId);
  clearSoundCloudSessionCookie(res);
  clearSoundCloudAuthCookies(res);
  req.cookies[SESSION_COOKIE] = "";
  req.cookies.soundcloud_token = "";
  req.cookies.soundcloud_refresh_token = "";
};

export const refreshSoundCloudTokenValue = async (
  refreshToken: string,
): Promise<RefreshResult> => {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  let refreshPromise = refreshLocks.get(refreshToken);

  if (!refreshPromise) {
    refreshPromise = axios
      .post("https://secure.soundcloud.com/oauth/token", params.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      })
      .then((response) => ({
        accessToken: response.data?.access_token,
        refreshToken: response.data?.refresh_token || refreshToken,
        expiresIn: response.data?.expires_in || 3600,
      }))
      .catch((error: any) => {
        if (error.response?.data?.error === "invalid_grant") {
          return null;
        }
        throw error;
      })
      .finally(() => {
        refreshLocks.delete(refreshToken);
      });

    refreshLocks.set(refreshToken, refreshPromise);
  }

  return await refreshPromise;
};

export const getRequestSoundCloudToken = async (
  req: NextApiRequest,
  res: NextApiResponse,
  options?: { refreshIfNeeded?: boolean },
): Promise<string | null> => {
  const refreshIfNeeded = options?.refreshIfNeeded !== false;
  const sessionState = await getSessionStateFromRequest(req, res);

  if (sessionState?.tokens) {
    const needsRefresh =
      refreshIfNeeded &&
      Boolean(sessionState.tokens.refreshToken) &&
      sessionState.tokens.expiresAt <= Date.now() + REFRESH_GRACE_MS;

    if (!needsRefresh) {
      return sessionState.tokens.accessToken;
    }
  }

  if (req.cookies.soundcloud_token && !sessionState?.tokens) {
    return req.cookies.soundcloud_token;
  }

  if (!refreshIfNeeded) {
    return sessionState?.tokens?.accessToken || req.cookies.soundcloud_token || null;
  }

  const refreshed = await refreshSoundCloudAuth(req, res);
  return refreshed?.rawToken || null;
};

export const requireSoundCloudAccessToken = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<string | null> => {
  return await getRequestSoundCloudToken(req, res);
};

export const getRequestSoundCloudAuthContext = async (
  req: NextApiRequest,
  res: NextApiResponse,
  options?: { refreshIfNeeded?: boolean },
): Promise<SoundCloudAuthContext | null> => {
  const token = await getRequestSoundCloudToken(req, res, options);
  return getSoundCloudAuthContext(token || undefined);
};

export const refreshSoundCloudAuth = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<SoundCloudAuthContext | null> => {
  const sessionState = await getSessionStateFromRequest(req, res);
  const refreshToken =
    sessionState?.tokens?.refreshToken || req.cookies.soundcloud_refresh_token;

  if (!refreshToken) {
    return null;
  }

  const refreshed = await refreshSoundCloudTokenValue(refreshToken);

  if (!refreshed) {
    const sessionId = req.cookies[SESSION_COOKIE];
    const userId = sessionState?.session?.userId;
    clearSessionFromStores(sessionId, userId);
    clearSoundCloudSessionCookie(res);
    clearSoundCloudAuthCookies(res);
    req.cookies[SESSION_COOKIE] = "";
    req.cookies.soundcloud_token = "";
    req.cookies.soundcloud_refresh_token = "";
    return null;
  }

  if (sessionState?.session?.userId) {
    persistUserTokens(
      sessionState.session.userId,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresIn,
      sessionState.tokens?.username,
      sessionState.tokens?.webCredentials,
    );
    setSoundCloudSessionCookie(res, sessionState.session.sessionId);
    syncRequestCookies(
      req,
      refreshed.accessToken,
      refreshed.refreshToken,
      sessionState.session.sessionId,
    );
  } else {
    await establishSoundCloudSession(
      req,
      res,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresIn,
    );
  }

  setSoundCloudAuthCookies(
    res,
    refreshed.accessToken,
    refreshed.refreshToken,
    refreshed.expiresIn,
  );

  return getSoundCloudAuthContext(refreshed.accessToken);
};










