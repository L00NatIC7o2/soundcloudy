import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import puppeteer, { type Browser, type Page } from "puppeteer";

const artistCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();
const CACHE_TTL_MS = 60_000;
const BANNER_NAV_TIMEOUT_MS = 10_000;
const BANNER_WAIT_TIMEOUT_MS = 3_000;
let browserPromise: Promise<Browser> | null = null;

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const token = req.cookies.soundcloud_token;

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
    const userResponse = await axios.get(
      `https://api.soundcloud.com/users/${id}`,
      {
        headers: {
          Authorization: `OAuth ${token}`,
        },
        timeout: 10000,
      },
    );

    const user = userResponse.data;

    console.log("Artist verified status:", user.verified);
    console.log("Artist badges:", user.badges);

    // Use API verified flag (more reliable than scraping)
    const verified = Boolean(user.verified || user.badges?.verified);
    const fetchBanner = async () => {
      let banner_url = null;
      let page: Page | null = null;
      try {
        const browser = await getBrowser();
        page = await browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const resourceType = request.resourceType();
          if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });
        page.setDefaultNavigationTimeout(BANNER_NAV_TIMEOUT_MS);
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );
        await page.goto(`https://soundcloud.com/${user.permalink}`, {
          waitUntil: "domcontentloaded",
          timeout: BANNER_NAV_TIMEOUT_MS,
        });

        try {
          await page.waitForSelector(".profileHeaderBackground__visual", {
            timeout: BANNER_WAIT_TIMEOUT_MS,
          });
        } catch (error) {
          // Continue to evaluate without selector if it never appears
        }

        const scrapedData = await page.evaluate(() => {
          let banner = null;

          const element = document.querySelector(
            ".profileHeaderBackground__visual",
          );

          if (element) {
            const style = element.getAttribute("style");
            if (style) {
              const match = style.match(/background-image:\s*url\(([^)]+)\)/);
              if (match && match[1]) {
                banner = match[1].replace(/^['"]|['"]$/g, "");
              }
            }
          }

          return { banner };
        });

        banner_url = scrapedData.banner;
      } catch (error) {
        console.error("Failed to scrape banner with Puppeteer:", error);
      } finally {
        if (page) await page.close();
      }

      return banner_url;
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
