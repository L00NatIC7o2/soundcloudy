import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import puppeteer from "puppeteer";

const profileCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();
const CACHE_TTL_MS = 60_000;
const BANNER_NAV_TIMEOUT_MS = 10_000;
const BANNER_WAIT_TIMEOUT_MS = 3_000;
let browserPromise: Promise<puppeteer.Browser> | null = null;

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

    const response = await axios.get("https://api.soundcloud.com/me", {
      headers: {
        Authorization: `OAuth ${token}`,
      },
      timeout: 10000,
    });

    const user = response.data;

    console.log("User verified status:", user.verified);
    console.log("User badges:", user.badges);

    // Use API verified flag (more reliable than scraping)
    const verified = Boolean(user.verified || user.badges?.verified);
    const fetchBanner = async () => {
      let banner_url = null;
      let page: puppeteer.Page | null = null;
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

    const fetchTracks = async () => {
      try {
        const tracksResponse = await axios.get(
          "https://api.soundcloud.com/users/" + user.id + "/tracks",
          {
            headers: {
              Authorization: `OAuth ${token}`,
            },
            params: {
              limit: 50,
              access: "playable",
            },
            timeout: 8000,
          },
        );
        return Array.isArray(tracksResponse.data)
          ? tracksResponse.data
          : tracksResponse.data?.collection || [];
      } catch (error) {
        console.error("Failed to fetch user tracks:", error);
        return [];
      }
    };

    const [banner_url, tracks] = await Promise.all([
      fetchBanner(),
      fetchTracks(),
    ]);

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
    };

    const cacheTtl = banner_url ? CACHE_TTL_MS : 10_000;
    profileCache.set(cacheKey, {
      expiresAt: Date.now() + cacheTtl,
      payload,
    });

    return res.json(payload);
  } catch (error: any) {
    console.error(
      "Profile fetch error:",
      error.response?.status,
      error.response?.data || error.message,
    );

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch profile" });
  }
}
