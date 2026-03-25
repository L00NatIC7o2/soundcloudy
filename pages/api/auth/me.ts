import type { NextApiRequest, NextApiResponse } from "next";
import axios, { type AxiosResponse } from "axios";
import puppeteer, { type Browser, type Page } from "puppeteer";

const profileCache = new Map<
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

const fetchPaginatedCollection = async (
  url: string,
  token: string,
  params: Record<string, string | number>,
  maxItems: number,
) => {
  let items: any[] = [];
  let nextUrl: string | null = url;
  let firstRequest = true;

  while (nextUrl && items.length < maxItems) {
    const response: AxiosResponse<any> = await axios.get(nextUrl, {
      headers: { Authorization: `OAuth ${token}` },
      params: firstRequest
        ? { ...params, limit: 200, linked_partitioning: 1 }
        : undefined,
      timeout: 8000,
    });

    const data: any = response.data;
    const collection = Array.isArray(data) ? data : data?.collection || [];
    items = items.concat(collection);
    nextUrl = data?.next_href || null;
    firstRequest = false;
  }

  return items.slice(0, maxItems);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const token = req.cookies.soundcloud_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const cacheKey = `${token}:me`;
    const cached = profileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload);
    }

    // 1. Fetch User Info from API
    const userRes = await axios.get("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${token}` },
    });
    const user = userRes.data;

    // Match the artist-profile banner scrape so self-profile banners resolve the same way.
    const fetchBanner = async (profilePermalink: string) => {
      let bannerUrl: string | null = null;
      let page: Page | null = null;
      try {
        const browser = await getBrowser();
        page = await browser.newPage();

        page.setDefaultNavigationTimeout(BANNER_NAV_TIMEOUT_MS);
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const resourceType = request.resourceType();
          if (["image", "font", "media"].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        });

        await page.goto(`https://soundcloud.com/${profilePermalink}`, {
          waitUntil: "domcontentloaded",
          timeout: BANNER_NAV_TIMEOUT_MS,
        });

        try {
          await page.waitForSelector(".profileHeaderBackground__visual", {
            timeout: BANNER_WAIT_TIMEOUT_MS,
          });
        } catch (error) {
          // Continue to evaluate even if the selector never appears in time.
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

          if (!banner) {
            const scriptTexts = Array.from(document.scripts)
              .map((script) => script.textContent || "")
              .join("\n");

            const patterns = [
              /"visual_url":"([^"]+)"/,
              /"banner_url":"([^"]+)"/,
              /"header_image_url":"([^"]+)"/,
            ];

            for (const pattern of patterns) {
              const match = scriptTexts.match(pattern);
              if (match?.[1]) {
                banner = match[1]
                  .replace(/\\u002F/g, "/")
                  .replace(/\\\//g, "/");
                break;
              }
            }
          }

          return { banner };
        });

        bannerUrl = scrapedData.banner;
      } catch (e) {
        console.error("Scraping failed:", e);
      } finally {
        if (page) await page.close();
      }

      return bannerUrl;
    };

    const fetchTracks = async () => {
      try {
        const maxTracks = Math.min(user.track_count || 500, 1000);
        return await fetchPaginatedCollection(
          "https://api.soundcloud.com/me/tracks",
          token,
          { access: "playable" },
          maxTracks,
        );
      } catch (error) {
        console.error("Failed to fetch profile tracks:", error);
        return [];
      }
    };

    const fetchPlaylists = async () => {
      try {
        return await fetchPaginatedCollection(
          "https://api.soundcloud.com/me/playlists",
          token,
          {},
          500,
        );
      } catch (error) {
        console.error("Failed to fetch profile playlists:", error);
        return [];
      }
    };

    const fetchReposts = async () => {
      try {
        const rawItems = await fetchPaginatedCollection(
          "https://api.soundcloud.com/me/reposts/tracks",
          token,
          {},
          300,
        );
        return rawItems
          .map((item: any) => item?.track || item?.origin || item)
          .filter((item: any) => item?.kind === "track" || item?.title);
      } catch (error) {
        console.error("Failed to fetch profile reposts:", error);
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

    // 3. Parallel fetching
    const [banner_url, tracks, playlistsRaw, reposts] = await Promise.all([
      fetchBanner(user.permalink),
      fetchTracks(),
      fetchPlaylists(),
      fetchReposts(),
    ]);
    const { albums, playlists } = splitPlaylists(playlistsRaw);

    const payload = {
      id: user.id,
      urn: user.urn || `soundcloud:users:${user.id}`,
      username: user.username,
      avatar_url: user.avatar_url,
      banner_url,
      description: user.description,
      links: Array.isArray(user.links) ? user.links : [],
      website: user.website || null,
      website_title: user.website_title || null,
      followers_count: user.followers_count,
      followings_count: user.followings_count,
      track_count: user.track_count,
      verified: Boolean(user.verified || user.badges?.verified),
      tracks,
      albums,
      playlists,
      reposts,
    };

    const cacheTtl = banner_url ? CACHE_TTL_MS : 10_000;
    profileCache.set(cacheKey, {
      expiresAt: Date.now() + cacheTtl,
      payload,
    });

    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("Error in /me:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
