import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import {
  refreshSoundCloudAuth,
  requireSoundCloudAccessToken,
} from "../../../src/server/auth/soundcloud";
const artistCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();
const CACHE_TTL_MS = 60_000;

const extractBannerFromProfileHtml = (html: string) => {
  const normalizeUrl = (value: string) =>
    value
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .replace(/^['"]|['"]$/g, "");

  const profileHeader = html.match(
    /<[^>]*profileHeaderBackground__visual[^>]*>/i,
  )?.[0];
  const style = profileHeader?.match(/\sstyle=(["'])(.*?)\1/i)?.[2];
  const backgroundUrl = style?.match(
    /background-image\s*:\s*url\(\s*(['"]?)(.*?)\1\s*\)/i,
  )?.[2];
  if (backgroundUrl) return normalizeUrl(backgroundUrl);

  const bannerFields = /"(?:banner_url|header_image_url|visual_url)"\s*:\s*"((?:\\.|[^"\\])+)"/gi;
  for (const match of html.matchAll(bannerFields)) {
    const url = normalizeUrl(match[1]);
    if (/^https?:\/\//i.test(url)) return url;
  }

  return null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  let token = await requireSoundCloudAccessToken(req, res);

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing artist ID" });
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const cacheKey = `${token}:${id}`;
    const cached = artistCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    // Fetch user info
    const fetchUser = async (accessToken: string) =>
      await axios.get(`https://api.soundcloud.com/users/${id}`, {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
        timeout: 10000,
      });

    let userResponse;
    try {
      userResponse = await fetchUser(token);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }

      const refreshedAuth = await refreshSoundCloudAuth(req, res, {
        force: true,
        clearOnFailure: false,
      });
      if (!refreshedAuth) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      token = refreshedAuth.rawToken;
      userResponse = await fetchUser(token);
    }

    const user = userResponse.data;

    console.log("Artist verified status:", user.verified);
    console.log("Artist badges:", user.badges);

    // Use API verified flag (more reliable than scraping)
    const verified = Boolean(user.verified || user.badges?.verified);
    const fetchBanner = async () => {
      const visuals = Array.isArray(user.visuals?.visuals)
        ? user.visuals.visuals
        : Array.isArray(user.visuals)
          ? user.visuals
          : [];
      const apiBanner =
        user.banner_url ||
        user.header_image_url ||
        user.visual_url ||
        visuals.find((visual: any) => visual?.visual_url)?.visual_url ||
        null;
      if (apiBanner) return apiBanner;

      try {
        if (typeof user.permalink !== "string" || !user.permalink) return null;
        const profileUrl = `https://soundcloud.com/${encodeURIComponent(user.permalink)}`;
        const response = await axios.get<string>(profileUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
          },
          responseType: "text",
          timeout: 10000,
        });
        return extractBannerFromProfileHtml(response.data);
      } catch (error) {
        console.error("Failed to fetch profile banner:", error);
        return null;
      }
    };

    const fetchPaginatedCollection = async (
      url: string,
      params: Record<string, string | number>,
      maxItems: number,
    ) => {
      let items: any[] = [];
      let nextUrl: string | null = url;
      let firstRequest = true;

      while (nextUrl && items.length < maxItems) {
        const response: any = await axios.get(nextUrl, {
          headers: {
            Authorization: `OAuth ${token}`,
          },
          params: firstRequest
            ? { ...params, limit: 200, linked_partitioning: 1 }
            : undefined,
          timeout: 8000,
        });

        const data = response.data;
        const collection = Array.isArray(data) ? data : data?.collection || [];
        items = items.concat(collection);
        nextUrl = data?.next_href || null;
        firstRequest = false;
      }

      return items.slice(0, maxItems);
    };

    const fetchTracks = async () => {
      try {
        const maxTracks = Math.min(user.track_count || 500, 1000);
        return await fetchPaginatedCollection(
          `https://api.soundcloud.com/users/${id}/tracks`,
          { access: "playable" },
          maxTracks,
        );
      } catch (error) {
        console.error("Failed to fetch artist tracks:", error);
        return [];
      }
    };

    const fetchPlaylists = async () => {
      try {
        return await fetchPaginatedCollection(
          `https://api.soundcloud.com/users/${id}/playlists`,
          {},
          500,
        );
      } catch (error) {
        console.error("Failed to fetch artist playlists:", error);
        return [];
      }
    };

    const fetchReposts = async () => {
      try {
        const rawItems = await fetchPaginatedCollection(
          `https://api.soundcloud.com/users/${encodeURIComponent(user.urn)}/reposts/tracks`,
          {},
          300,
        );
        return rawItems
          .map((item: any) => item?.track || item?.origin || item)
          .filter((item: any) => item?.kind === "track" || item?.title);
      } catch (error) {
        console.error("Failed to fetch artist reposts:", error);
        return [];
      }
    };

    const splitPlaylists = (items: any[]) => {
      const albums: any[] = [];
      const playlists: any[] = [];
      items.forEach((item) => {
        const isAlbum = Boolean(
          item?.is_album ||
          item?.set_type === "album" ||
          item?.kind === "album",
        );
        if (isAlbum) {
          albums.push(item);
        } else {
          playlists.push(item);
        }
      });
      return { albums, playlists };
    };

    const [banner_url, tracks, playlistsRaw, reposts] = await Promise.all([
      fetchBanner(),
      fetchTracks(),
      fetchPlaylists(),
      fetchReposts(),
    ]);
    const { albums, playlists } = splitPlaylists(playlistsRaw);

    const payload = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      permalink_url: user.permalink_url,
      banner_url: banner_url,
      description: user.description,
      links: Array.isArray(user.links) ? user.links : [],
      website: user.website || null,
      website_title: user.website_title || null,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      track_count: user.track_count,
      verified: verified || false,
      tracks,
      albums,
      playlists,
      reposts,
    };

    const cacheTtl = banner_url ? CACHE_TTL_MS : 10_000;
    artistCache.set(cacheKey, {
      expiresAt: Date.now() + cacheTtl,
      payload,
    });

    return res.json(payload);
  } catch (error: any) {
    console.error(
      "Artist fetch error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch artist profile" });
  }
}
