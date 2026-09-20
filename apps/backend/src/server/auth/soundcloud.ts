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
// Dedupe in-flight auth refreshes per session/user to avoid races
const authRefreshLocks = new Map<
  string,
  Promise<SoundCloudAuthContext | null>
>();
// Track consecutive refresh failures per session to avoid clearing on transient failures
const sessionRefreshFailures = new Map<
  string,
  { count: number; lastFailedAt: number }
>();
const REFRESH_FAILURE_CLEAR_THRESHOLD = 5;
// When a session experiences a transient failure, enter a short cooldown to
// avoid repeated aggressive refresh attempts that can race or cause clears.
const REFRESH_FAILURE_COOLDOWN_MS = 30_000; // 30 seconds

export const getSessionRefreshFailureInfo = (sessionId?: string) => {
  if (!sessionId) return null;
  const entry = sessionRefreshFailures.get(sessionId);
  if (!entry) return null;
  return { count: entry.count, lastFailedAt: entry.lastFailedAt };
};

const getHeaderValue = (header?: string | string[]) =>
  Array.isArray(header) ? header[0] : header;

const getHeaderAccessToken = (req: NextApiRequest) => {
  const authorization = getHeaderValue(req.headers.authorization);
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const getHeaderRefreshToken = (req: NextApiRequest) => {
  const refreshHeader = getHeaderValue(
    req.headers["x-soundcloud-refresh-token"],
  );
  return refreshHeader?.trim() || null;
};

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

    // Do not aggressively clear session here; allow refresh logic and failure counters
    // to determine whether a session should be cleared to avoid logout loops.
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
  syncRequestCookies(
    req,
    tokens.accessToken,
    tokens.refreshToken,
    session.sessionId,
  );

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
  // Debug marker: log stack trace when a session is cleared to aid diagnosis
  try {
    const userId = session?.userId;
    console.warn("SOUNDCLoudY_CLEAR_MARKER - clearing session", {
      sessionId,
      userId,
    });
    // include stack for debugging
    console.warn(new Error("clearSoundCloudSession stack").stack);
  } catch (e) {
    // ignore
  }
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
      .post("https://api.soundcloud.com/oauth2/token", params.toString(), {
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
        const status = error.response?.status;
        const oauthError = error.response?.data?.error;

        if (
          oauthError === "invalid_grant" ||
          status === 400 ||
          status === 401
        ) {
          console.warn("Token refresh rejected by SoundCloud", {
            status,
            error: oauthError || null,
          });
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

  const headerAccessToken = getHeaderAccessToken(req);
  if (headerAccessToken) {
    return headerAccessToken;
  }

  if (!refreshIfNeeded) {
    return (
      sessionState?.tokens?.accessToken ||
      req.cookies.soundcloud_token ||
      headerAccessToken ||
      null
    );
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
  options?: { force?: boolean; clearOnFailure?: boolean },
): Promise<SoundCloudAuthContext | null> => {
  const forceRefresh = options?.force === true;
  const clearOnFailure = options?.clearOnFailure === true;
  const sessionState = await getSessionStateFromRequest(req, res);
  const currentAccessToken =
    sessionState?.tokens?.accessToken || req.cookies.soundcloud_token || null;

  console.log("refreshSoundCloudAuth - called", {
    forceRefresh,
    clearOnFailure,
    sessionUserId: sessionState?.session?.userId,
    hasSessionTokens: !!sessionState?.tokens,
    currentAccessTokenPresent: !!currentAccessToken,
  });

  const doRefresh = async (): Promise<SoundCloudAuthContext | null> => {
    const refreshToken =
      sessionState?.tokens?.refreshToken ||
      req.cookies.soundcloud_refresh_token ||
      getHeaderRefreshToken(req);

    console.log(
      "refreshSoundCloudAuth - refreshToken present:",
      !!refreshToken,
    );

    // If this session recently failed a refresh, enter a short cooldown to
    // avoid hammering the refresh endpoint and causing race clears.
    let sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) {
      const prev = sessionRefreshFailures.get(sessionId);
      if (prev && prev.count > 0) {
        const since = Date.now() - (prev.lastFailedAt || 0);
        if (since < REFRESH_FAILURE_COOLDOWN_MS) {
          console.log(
            "refreshSoundCloudAuth - in cooldown after recent failures, skipping refresh",
            { sessionId, failureCount: prev.count, since },
          );
          // A forced refresh is only requested after SoundCloud rejected the
          // current token. Returning that same token makes auth/check retry a
          // known-bad credential and turns a transient failure into a logout.
          if (forceRefresh) {
            return null;
          }

          return getSoundCloudAuthContext(currentAccessToken || undefined);
        }
      }
    }
    if (!refreshToken) {
      if (forceRefresh) {
        if (clearOnFailure) {
          sessionId = req.cookies[SESSION_COOKIE];
          const userId = sessionState?.session?.userId;
          if (userId) {
            console.log(
              "refreshSoundCloudAuth - clearing session due to missing refresh token (force)",
              { sessionId, userId },
            );
            clearSessionFromStores(sessionId, userId);
            clearSoundCloudSessionCookie(res);
            clearSoundCloudAuthCookies(res);
            req.cookies[SESSION_COOKIE] = "";
            req.cookies.soundcloud_token = "";
            req.cookies.soundcloud_refresh_token = "";
          } else {
            console.log(
              "refreshSoundCloudAuth - skip clearing session store (no session.userId). Preserving legacy cookie tokens.",
              { sessionId },
            );
          }
        }
        return null;
      }

      return getSoundCloudAuthContext(currentAccessToken || undefined);
    }

    const refreshed = await refreshSoundCloudTokenValue(refreshToken);

    if (!refreshed) {
      console.warn(
        "refreshSoundCloudAuth - refreshSoundCloudTokenValue returned null for token",
        refreshToken ? "[REDACTED]" : null,
      );
      if (!forceRefresh && currentAccessToken) {
        return getSoundCloudAuthContext(currentAccessToken);
      }
      sessionId = req.cookies[SESSION_COOKIE];
      const userId = sessionState?.session?.userId;

      // Track consecutive failures and avoid clearing for transient issues
      if (sessionId) {
        const prev = sessionRefreshFailures.get(sessionId) || {
          count: 0,
          lastFailedAt: 0,
        };
        prev.count = prev.count + 1;
        prev.lastFailedAt = Date.now();
        sessionRefreshFailures.set(sessionId, prev);
      }

      const failureCount = sessionId
        ? sessionRefreshFailures.get(sessionId)?.count || 0
        : 0;
      if (!clearOnFailure && failureCount < REFRESH_FAILURE_CLEAR_THRESHOLD) {
        console.log(
          "refreshSoundCloudAuth - transient refresh failure, not clearing session yet",
          { sessionId, failureCount },
        );
        return null;
      }

      if (userId) {
        console.log(
          "refreshSoundCloudAuth - clearing session due to failed token refresh",
          { sessionId, userId, failureCount },
        );
        clearSessionFromStores(sessionId, userId);
        clearSoundCloudSessionCookie(res);
        clearSoundCloudAuthCookies(res);
        req.cookies[SESSION_COOKIE] = "";
        req.cookies.soundcloud_token = "";
        req.cookies.soundcloud_refresh_token = "";
      } else {
        console.log(
          "refreshSoundCloudAuth - skip clearing session store after failed refresh (no session.userId). Preserving legacy cookie tokens.",
          { sessionId },
        );
      }

      if (sessionId) sessionRefreshFailures.delete(sessionId);
      return null;
    }

    const knownSession = sessionState?.session;
    const knownTokens = sessionState?.tokens;

    // The refresh exchange is authoritative. For an existing session, keep
    // its known user id and install the new tokens immediately. A transient
    // /me failure must not discard an otherwise valid refreshed credential.
    if (knownSession) {
      persistUserTokens(
        knownSession.userId,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.expiresIn,
        knownTokens?.username,
        knownTokens?.webCredentials,
      );
      setSoundCloudSessionCookie(res, knownSession.sessionId);
      setSoundCloudAuthCookies(
        res,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.expiresIn,
      );
      syncRequestCookies(
        req,
        refreshed.accessToken,
        refreshed.refreshToken,
        knownSession.sessionId,
      );
      sessionRefreshFailures.delete(knownSession.sessionId);
      return getSoundCloudAuthContext(refreshed.accessToken);
    }

    let refreshedUser: {
      userId: string;
      username: string | null;
    } | null = null;

    try {
      refreshedUser = await fetchSoundCloudUser(refreshed.accessToken);
    } catch {
      console.warn(
        "refreshSoundCloudAuth - fetchSoundCloudUser failed for refreshed access token",
      );
      // There is no known user to rehydrate, but the refresh exchange still
      // produced a new credential. Keep it in cookies and let the request
      // that triggered refresh validate it instead of forcing a logout.
      setSoundCloudAuthCookies(
        res,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.expiresIn,
      );
      syncRequestCookies(req, refreshed.accessToken, refreshed.refreshToken);
      return getSoundCloudAuthContext(refreshed.accessToken);
    }

    if (sessionState?.session?.userId) {
      persistUserTokens(
        refreshedUser.userId,
        refreshed.accessToken,
        refreshed.refreshToken,
        refreshed.expiresIn,
        refreshedUser.username,
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

    // Success — reset any failure counter for this session
    sessionId = req.cookies[SESSION_COOKIE];
    if (sessionId) sessionRefreshFailures.delete(sessionId);

    return getSoundCloudAuthContext(refreshed.accessToken);
  };

  const sessionIdCookie = req.cookies[SESSION_COOKIE];
  const dedupeKey =
    sessionState?.session?.sessionId ||
    sessionIdCookie ||
    sessionState?.session?.userId ||
    null;

  if (dedupeKey) {
    const existing = authRefreshLocks.get(dedupeKey);
    if (existing) {
      console.log(
        "refreshSoundCloudAuth - awaiting in-flight refresh for key",
        dedupeKey,
      );
      return existing;
    }

    const p = doRefresh();
    authRefreshLocks.set(dedupeKey, p);
    p.finally(() => authRefreshLocks.delete(dedupeKey));
    return p;
  }

  return await doRefresh();
};
