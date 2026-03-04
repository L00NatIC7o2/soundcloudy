import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import puppeteer from "puppeteer"; // Switched to standard puppeteer

const profileCache = new Map<
  string,
  { expiresAt: number; payload: Record<string, unknown> }
>();
const CACHE_TTL_MS = 60_000;

// Simplified Local Browser Launch
const getBrowser = async () => {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
    ],
  });
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

    // 2. Optimized Scraper for Banner
    const fetchBanner = async (profileUrl: string) => {
      let browser = null;
      try {
        browser = await getBrowser();
        const page = await browser.newPage();

        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        );

        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const type = request.resourceType();
          // We only need the HTML and images (for the banner)
          if (["font", "stylesheet", "media", "script"].includes(type)) {
            request.abort();
          } else {
            request.continue();
          }
        });

        await page.goto(profileUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        return await page.evaluate(() => {
          const bannerElement = document.querySelector(
            ".profileHeaderBackground__visual",
          ) as HTMLElement;
          if (!bannerElement) return null;
          const style = window.getComputedStyle(bannerElement).backgroundImage;
          const match = style.match(/url\("?(.+?)"?\)/);
          return match ? match[1].replace("t500x500", "original") : null;
        });
      } catch (e) {
        console.error("Scraping failed:", e);
        return null;
      } finally {
        if (browser) await browser.close();
      }
    };

    // 3. Parallel fetching
    const [banner_url, tracksRes, playlistsRes] = await Promise.all([
      fetchBanner(user.permalink_url),
      axios.get(`https://api.soundcloud.com/me/tracks`, {
        headers: { Authorization: `OAuth ${token}` },
      }),
      axios.get(`https://api.soundcloud.com/me/playlists`, {
        headers: { Authorization: `OAuth ${token}` },
      }),
    ]);

    const payload = {
      id: user.id,
      urn: user.urn || `soundcloud:users:${user.id}`,
      username: user.username,
      avatar_url: user.avatar_url,
      banner_url,
      description: user.description,
      followers_count: user.followers_count,
      track_count: user.track_count,
      tracks: tracksRes.data,
      playlists: playlistsRes.data,
    };

    profileCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return res.status(200).json(payload);
  } catch (error: any) {
    console.error("Error in /me:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
